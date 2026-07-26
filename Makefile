.PHONY: dev dev-down prod-up prod-down update generate-master-key

## Desarrollo
dev:
	docker compose -f docker-compose.dev.yml up --build

dev-down:
	docker compose -f docker-compose.dev.yml down

## Produccion
generate-master-key:
	./scripts/generate-master-key.sh

prod-up:
	docker compose up -d

prod-down:
	docker compose down

## make update VERSION=1.3.0  (incluye backup automatico antes de migrar)
update:
	./scripts/manufactoo-update.sh $(VERSION)
