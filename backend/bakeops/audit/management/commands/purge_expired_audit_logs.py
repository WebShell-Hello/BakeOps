from django.core.management.base import BaseCommand, CommandParser
from django.utils import timezone

from bakeops.audit.models import AccessLog, AuditLog


class Command(BaseCommand):
    help = "Delete access and audit logs whose retention period has expired."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--batch-size", type=int, default=5000)

    def handle(self, *args: object, **options: object) -> None:
        batch_size_option = options["batch_size"]
        if not isinstance(batch_size_option, int):
            raise TypeError("batch-size must be an integer")
        batch_size = max(1, batch_size_option)
        total = 0
        for model in (AccessLog, AuditLog):
            deleted = self._purge_model(model, batch_size)
            total += deleted
            self.stdout.write(f"Deleted {deleted} expired {model._meta.verbose_name_plural}.")
        self.stdout.write(self.style.SUCCESS(f"Deleted {total} expired log records."))

    @staticmethod
    def _purge_model(model: type[AccessLog] | type[AuditLog], batch_size: int) -> int:
        deleted_total = 0
        while True:
            ids = list(
                model.objects.filter(retention_expires_at__lte=timezone.now()).values_list("pk", flat=True)[:batch_size]
            )
            if not ids:
                return deleted_total
            deleted, _ = model.objects.filter(pk__in=ids).delete()
            deleted_total += deleted
