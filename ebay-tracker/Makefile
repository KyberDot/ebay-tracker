.PHONY: up down build pull logs shell-backend shell-frontend backup

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

pull:
	docker compose pull

logs:
	docker compose logs -f

shell-backend:
	docker compose exec backend sh

shell-frontend:
	docker compose exec frontend sh

backup:
	docker compose cp backend:/app/data/ebay_tracker.db ./backup-$(shell date +%Y%m%d-%H%M%S).db
	@echo "Backup saved."

restart:
	docker compose restart

reset-db:
	@echo "WARNING: This will delete all data!"
	@read -p "Type 'yes' to confirm: " c; [ "$$c" = "yes" ] && docker compose exec backend sh -c "rm -f /app/data/ebay_tracker.db" && docker compose restart backend
