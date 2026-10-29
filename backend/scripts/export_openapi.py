import json
from pathlib import Path

from tasktracker.bootstrap import create_app
from tasktracker.infrastructure.settings import Settings

# Schema export must not depend on developer credentials or an available database.
app = create_app(Settings.model_construct(environment="test"))
target = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"
target.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
