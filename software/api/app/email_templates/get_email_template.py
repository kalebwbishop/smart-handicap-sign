import os
from typing import Optional

def get_email_template(template_name: str) -> Optional[str]:
    template_path = os.path.join(os.path.dirname(__file__), template_name)
    if not os.path.isfile(template_path):
        return None
    with open(template_path, "r", encoding="utf-8") as file:
        return file.read()