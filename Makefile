.PHONY: ext-build ext-build-local ext-dev web-dev web-build

# Read SUPABASE_ANON_KEY from web/.env.local automatically
SUPABASE_ANON_KEY_VAL := $(shell grep NEXT_PUBLIC_SUPABASE_ANON_KEY apps/web/.env.local 2>/dev/null | cut -d= -f2-)

# Production build — API points to https://overlink-web.vercel.app
ext-build:
	cd apps/extension && SUPABASE_ANON_KEY=$(SUPABASE_ANON_KEY_VAL) npm run build

# Local dev build — API points to http://localhost:3000
ext-build-local:
	cd apps/extension && API_BASE=http://localhost:3000 SUPABASE_ANON_KEY=$(SUPABASE_ANON_KEY_VAL) npm run build

ext-dev:
	cd apps/extension && npm run dev

web-build:
	cd apps/web && npm run build

web-dev:
	cd apps/web && npm run dev
