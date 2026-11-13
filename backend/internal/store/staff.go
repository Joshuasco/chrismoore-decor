package store

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"chrismoore-decor/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

// ---------- Admin & staff accounts ----------

const userColumns = `u.id, u.email, u.name, u.role, u.status, u.group_id::text, coalesce(g.name, ''),
	coalesce(g.permissions, '{}'), u.password_hash, u.status_changed_at, u.last_login_at, u.created_at`

const userFrom = ` from admin_users u left join staff_groups g on g.id = u.group_id `

func scanUser(row pgx.Row) (models.AdminUser, error) {
	var u models.AdminUser
	err := row.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.Status, &u.GroupID, &u.GroupName,
		&u.Permissions, &u.PasswordHash, &u.StatusChangedAt, &u.LastLoginAt, &u.CreatedAt)
	if err != nil {
		return u, err
	}
	effectivePermissions(&u)
	return u, nil
}

// effectivePermissions gives admins every service and drops unknown keys.
func effectivePermissions(u *models.AdminUser) {
	if u.Role == "admin" {
		u.Permissions = models.PermissionKeys()
		return
	}
	known := models.PermissionKeys()
	out := []string{}
	for _, p := range u.Permissions {
		if slices.Contains(known, p) {
			out = append(out, p)
		}
	}
	u.Permissions = out
}

func (s *Store) AdminByEmail(ctx context.Context, email string) (models.AdminUser, error) {
	u, err := scanUser(s.db.QueryRow(ctx, `select `+userColumns+userFrom+`where u.email=$1`,
		strings.ToLower(strings.TrimSpace(email))))
	return u, mapErr(err)
}

func (s *Store) AdminByID(ctx context.Context, id string) (models.AdminUser, error) {
	u, err := scanUser(s.db.QueryRow(ctx, `select `+userColumns+userFrom+`where u.id=$1`, id))
	return u, mapErr(err)
}

// CountAdmins counts approved admins (accounts that can manage staff).
func (s *Store) CountAdmins(ctx context.Context) (int, error) {
	var n int
	err := s.db.QueryRow(ctx, `select count(*) from admin_users where role='admin' and status='approved'`).Scan(&n)
	return n, err
}

// CreateAdmin inserts an account with the given role and status.
func (s *Store) CreateAdmin(ctx context.Context, email, name, hash, role, status string) (models.AdminUser, error) {
	var id string
	err := s.db.QueryRow(ctx, `insert into admin_users (email, name, password_hash, role, status)
		values ($1,$2,$3,$4,$5) returning id`,
		strings.ToLower(strings.TrimSpace(email)), strings.TrimSpace(name), hash, role, status).Scan(&id)
	if err != nil {
		return models.AdminUser{}, mapErr(err)
	}
	return s.AdminByID(ctx, id)
}

// PromoteToAdmin makes an existing account an approved admin. Used to
// recover access via ADMIN_EMAIL when no approved admin is left.
func (s *Store) PromoteToAdmin(ctx context.Context, email string) (bool, error) {
	tag, err := s.db.Exec(ctx, `update admin_users set role='admin', status='approved', status_changed_at=now()
		where email=$1`, strings.ToLower(strings.TrimSpace(email)))
	return tag.RowsAffected() > 0, mapErr(err)
}

func (s *Store) UpdateAdminPassword(ctx context.Context, id, hash string) error {
	_, err := s.db.Exec(ctx, `update admin_users set password_hash=$2 where id=$1`, id, hash)
	return mapErr(err)
}

func (s *Store) TouchLogin(ctx context.Context, id string) {
	_, _ = s.db.Exec(ctx, `update admin_users set last_login_at=now() where id=$1`, id)
}

// ListUsers returns accounts, newest first, optionally filtered by status.
func (s *Store) ListUsers(ctx context.Context, status string) ([]models.AdminUser, error) {
	q := `select ` + userColumns + userFrom
	var args []any
	if status != "" {
		q += `where u.status=$1 `
		args = append(args, status)
	}
	rows, err := s.db.Query(ctx, q+`order by (u.status='pending') desc, u.created_at desc`, args...)
	if err != nil {
		return nil, mapErr(err)
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (models.AdminUser, error) { return scanUser(r) })
	if list == nil {
		list = []models.AdminUser{}
	}
	return list, mapErr(err)
}

func (s *Store) CountPendingStaff(ctx context.Context) (int, error) {
	var n int
	err := s.db.QueryRow(ctx, `select count(*) from admin_users where status='pending'`).Scan(&n)
	return n, mapErr(err)
}

func invalid(msg string) error { return fmt.Errorf("%w: %s", ErrInvalid, msg) }

// otherAdmins counts approved admins other than id, under the caller's tx.
func otherAdmins(ctx context.Context, tx pgx.Tx, id string) (int, error) {
	var n int
	err := tx.QueryRow(ctx, `select count(*) from admin_users where role='admin' and status='approved' and id<>$1`, id).Scan(&n)
	return n, err
}

// UpdateStaff approves, disapproves, changes the role of, or regroups an
// account. Nobody can change their own access, and the last approved
// admin can't be removed.
func (s *Store) UpdateStaff(ctx context.Context, id, actorID string, in models.StaffUpdate) (models.AdminUser, error) {
	if in.Status != nil && !slices.Contains([]string{"pending", "approved", "disapproved"}, *in.Status) {
		return models.AdminUser{}, invalid("status must be approved, disapproved or pending")
	}
	if in.Role != nil && *in.Role != "admin" && *in.Role != "staff" {
		return models.AdminUser{}, invalid("role must be admin or staff")
	}
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var role, status string
		if err := tx.QueryRow(ctx, `select role, status from admin_users where id=$1 for update`, id).Scan(&role, &status); err != nil {
			return err
		}
		newRole, newStatus := role, status
		if in.Role != nil {
			newRole = *in.Role
		}
		if in.Status != nil {
			newStatus = *in.Status
		}
		if id == actorID && (newRole != role || newStatus != status) {
			return invalid("you can't change your own role or approval")
		}
		if role == "admin" && status == "approved" && (newRole != "admin" || newStatus != "approved") {
			n, err := otherAdmins(ctx, tx, id)
			if err != nil {
				return err
			}
			if n == 0 {
				return invalid("at least one approved admin is required")
			}
		}
		if _, err := tx.Exec(ctx, `update admin_users set role=$2, status=$3,
			status_changed_at = case when status <> $3 then now() else status_changed_at end
			where id=$1`, id, newRole, newStatus); err != nil {
			return err
		}
		if in.GroupID != nil {
			if _, err := tx.Exec(ctx, `update admin_users set group_id=nullif($2,'')::uuid where id=$1`, id, *in.GroupID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return models.AdminUser{}, mapErr(err)
	}
	return s.AdminByID(ctx, id)
}

// DeleteStaff removes an account (not your own, and not the last admin).
func (s *Store) DeleteStaff(ctx context.Context, id, actorID string) error {
	if id == actorID {
		return invalid("you can't delete your own account")
	}
	return mapErr(pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var role, status string
		if err := tx.QueryRow(ctx, `select role, status from admin_users where id=$1 for update`, id).Scan(&role, &status); err != nil {
			return err
		}
		if role == "admin" && status == "approved" {
			n, err := otherAdmins(ctx, tx, id)
			if err != nil {
				return err
			}
			if n == 0 {
				return invalid("at least one approved admin is required")
			}
		}
		_, err := tx.Exec(ctx, `delete from admin_users where id=$1`, id)
		return err
	}))
}

// ---------- Staff groups ----------

// NormalizeGroup trims and validates a group before saving.
func NormalizeGroup(in *models.StaffGroupInput) error {
	in.Name = strings.TrimSpace(in.Name)
	in.Description = strings.TrimSpace(in.Description)
	switch {
	case in.Name == "":
		return invalid("give the group a name")
	case len([]rune(in.Name)) > 60:
		return invalid("group name is too long (60 characters max)")
	case len([]rune(in.Description)) > 300:
		return invalid("description is too long (300 characters max)")
	}
	known := models.PermissionKeys()
	perms := []string{}
	for _, p := range in.Permissions {
		if !slices.Contains(known, p) {
			return invalid("unknown service: " + p)
		}
		if !slices.Contains(perms, p) {
			perms = append(perms, p)
		}
	}
	in.Permissions = perms
	return nil
}

func (s *Store) ListGroups(ctx context.Context) ([]models.StaffGroup, error) {
	rows, err := s.db.Query(ctx, `select g.id, g.name, g.description, g.permissions,
			coalesce((select array_agg(u.id::text order by u.name) from admin_users u where u.group_id=g.id), '{}'),
			g.created_at, g.updated_at
		from staff_groups g order by lower(g.name)`)
	if err != nil {
		return nil, mapErr(err)
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (models.StaffGroup, error) {
		var g models.StaffGroup
		err := r.Scan(&g.ID, &g.Name, &g.Description, &g.Permissions, &g.MemberIDs, &g.CreatedAt, &g.UpdatedAt)
		return g, err
	})
	if list == nil {
		list = []models.StaffGroup{}
	}
	return list, mapErr(err)
}

// SaveGroup creates (id == "") or updates a group and, when MemberIDs is
// set, replaces its members. Admin accounts are never added to a group.
func (s *Store) SaveGroup(ctx context.Context, id string, in models.StaffGroupInput) (string, error) {
	if err := NormalizeGroup(&in); err != nil {
		return "", err
	}
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if id == "" {
			if err := tx.QueryRow(ctx, `insert into staff_groups (name, description, permissions)
				values ($1,$2,$3::text[]) returning id`, in.Name, in.Description, in.Permissions).Scan(&id); err != nil {
				return err
			}
		} else {
			tag, err := tx.Exec(ctx, `update staff_groups set name=$2, description=$3, permissions=$4::text[], updated_at=now()
				where id=$1`, id, in.Name, in.Description, in.Permissions)
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 {
				return pgx.ErrNoRows
			}
		}
		if in.MemberIDs == nil {
			return nil
		}
		members := *in.MemberIDs
		if members == nil {
			members = []string{}
		}
		if _, err := tx.Exec(ctx, `update admin_users set group_id=null
			where group_id=$1 and not (id::text = any($2::text[]))`, id, members); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `update admin_users set group_id=$1
			where id::text = any($2::text[]) and role='staff'`, id, members)
		return err
	})
	return id, mapErr(err)
}

func (s *Store) DeleteGroup(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `delete from staff_groups where id=$1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return mapErr(err)
}
