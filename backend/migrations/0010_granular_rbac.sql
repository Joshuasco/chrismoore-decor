-- Granular Role-Based Access Control: CRUD and direct user permissions
alter table admin_users
    add column if not exists direct_permissions text[] not null default '{}';

create index if not exists admin_users_direct_permissions_idx on admin_users using gin(direct_permissions);
create index if not exists staff_groups_permissions_idx on staff_groups using gin(permissions);
