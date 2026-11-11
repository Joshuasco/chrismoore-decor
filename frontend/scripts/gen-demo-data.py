#!/usr/bin/env python3
"""Generate src/lib/demo-data.ts from the backend seed SQL.

The storefront falls back to this data when the API/database is unreachable
or empty, so the demo always matches what `go run ./cmd/api -seed` loads.

    python3 scripts/gen-demo-data.py   (run from frontend/)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = (ROOT / "backend/migrations/seed/seed.sql").read_text()
BLOG = (ROOT / "backend/migrations/seed/blog.sql").read_text()
REVIEWS = (ROOT / "backend/migrations/seed/reviews.sql").read_text()
OUT = ROOT / "frontend/src/lib/demo-data.ts"


def tuples(sql: str, after: str):
    """Yield the raw text of each top-level (...) tuple following `after`."""
    i = sql.index(after) + len(after)
    depth, start, n = 0, None, len(sql)
    while i < n:
        if sql.startswith("$md$", i):
            i = sql.index("$md$", i + 4) + 4
            continue
        c = sql[i]
        if c == "'":
            i += 1
            while not (sql[i] == "'" and sql[i + 1 : i + 2] != "'"):
                i += 2 if sql[i] == "'" else 1
        elif c == "(":
            depth += 1
            if depth == 1:
                start = i + 1
        elif c == ")":
            depth -= 1
            if depth < 0:
                return  # closing paren of a "from (values ...)" list
            if depth == 0:
                yield sql[start:i]
        elif depth == 0 and (c == ";" or sql.startswith("on conflict", i)):
            return  # end of the VALUES list
        i += 1


def split_top(t: str):
    """Split a tuple body on top-level commas."""
    parts, depth, cur, i = [], 0, "", 0
    while i < len(t):
        if t.startswith("$md$", i):
            j = t.index("$md$", i + 4) + 4
            cur += t[i:j]
            i = j
            continue
        c = t[i]
        if c == "'":
            j = i + 1
            while not (t[j] == "'" and t[j + 1 : j + 2] != "'"):
                j += 2 if t[j] == "'" else 1
            cur += t[i : j + 1]
            i = j + 1
            continue
        if c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        if c == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += c
        i += 1
    parts.append(cur.strip())
    return parts


def value(v: str):
    v = v.strip()
    if v.startswith("$md$"):
        return v[4:-4].strip()
    if v.startswith("'"):
        return v[1:-1].replace("''", "'")
    if m := re.match(r"\(select id from c where slug='([^']+)'\)", v):
        return {"category": m.group(1)}
    if v.startswith("array[]"):
        return []
    if v.startswith("array["):
        return [value(x) for x in split_top(v[6:-1])]
    if m := re.match(r"now\(\) - interval '(\d+) days'", v):
        return {"days_ago": int(m.group(1))}
    if v in ("true", "false"):
        return v == "true"
    if v == "null":
        return None
    return float(v) if "." in v else int(v)


categories = []
for t in tuples(SEED, "insert into categories (name, slug, description, image_url, sort_order) values"):
    name, slug, desc, image, order = map(value, split_top(t))
    categories.append({"name": name, "slug": slug, "description": desc, "image_url": image, "sort_order": order})

products = []
for t in tuples(SEED, "is_featured, rating, review_count)\nvalues"):
    (cat, name, slug, sku, short, desc, price, compare, stock, images, colors, sizes,
     material, badge, featured, rating, reviews) = map(value, split_top(t))
    products.append({
        "category": cat["category"], "name": name, "slug": slug, "sku": sku,
        "short_description": short, "description": desc, "price": price, "compare_at_price": compare,
        "stock": stock, "images": images, "colors": colors, "sizes": sizes, "material": material,
        "badge": badge, "is_featured": featured, "rating": rating, "review_count": reviews,
    })

posts = []
for t in tuples(BLOG, "product_category, seo_description)\nvalues"):
    (title, slug, excerpt, content, cover, category, tags, status, featured, published,
     minutes, product_category, seo_desc) = map(value, split_top(t))
    posts.append({
        "title": title, "slug": slug, "excerpt": excerpt, "content": content, "cover_image": cover,
        "category": category, "tags": tags, "is_featured": featured, "days_ago": published["days_ago"],
        "reading_minutes": minutes, "product_category": product_category, "seo_description": seo_desc,
    })

reviews = []
for t in tuples(REVIEWS, "from (values"):
    slug, name, title, body, rating, verified, days = map(value, split_top(t))
    reviews.append({"product": slug, "name": name, "title": title, "body": body, "rating": rating,
                    "verified": verified, "days_ago": days})

assert len(reviews) > 0 and all(r["product"] in {p["slug"] for p in products} for r in reviews)
assert len(categories) == 5 and len(products) == 20 and len(posts) == 4, (len(categories), len(products), len(posts))

OUT.write_text(
    "// GENERATED by scripts/gen-demo-data.py from backend/migrations/seed/*.sql — do not edit by hand.\n"
    "// Demo catalogue used when the API or database is unavailable or empty.\n\n"
    f"export const DEMO_CATEGORIES = {json.dumps(categories, indent=2, ensure_ascii=False)} as const;\n\n"
    f"export const DEMO_PRODUCTS = {json.dumps(products, indent=2, ensure_ascii=False)} as const;\n\n"
    f"export const DEMO_POSTS = {json.dumps(posts, indent=2, ensure_ascii=False)} as const;\n\n"
    f"export const DEMO_REVIEWS = {json.dumps(reviews, indent=2, ensure_ascii=False)} as const;\n"
)
print(f"wrote {OUT.relative_to(ROOT)}: {len(categories)} categories, {len(products)} products, {len(posts)} posts, {len(reviews)} reviews")
