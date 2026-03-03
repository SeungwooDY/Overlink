.PHONY: ext-build ext-dev web-dev web-build

ext-build:
	cd apps/extension && npm run build

ext-dev:
	cd apps/extension && npm run dev

web-build:
	cd apps/web && npm run build

web-dev:
	cd apps/web && npm run dev
