from datetime import date, datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from ..models import AppSetting
from ..db import SessionLocal

SETTING_KEY = "simulated_today"


def get_today(db: Optional[Session] = None) -> date:
    """
    Returns the simulated today date if configured, otherwise the real date.today().
    Used across all features (reminders, overdue, digest, brief).
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        setting = db.query(AppSetting).filter(AppSetting.key == SETTING_KEY).first()
        if setting and setting.value and setting.value.strip():
            try:
                return datetime.strptime(setting.value.strip(), "%Y-%m-%d").date()
            except ValueError:
                pass
        return date.today()
    finally:
        if close_db:
            db.close()


def get_today_str(db: Optional[Session] = None) -> str:
    return get_today(db).strftime("%Y-%m-%d")


def get_today_status(db: Session) -> Tuple[str, bool]:
    setting = db.query(AppSetting).filter(AppSetting.key == SETTING_KEY).first()
    if setting and setting.value and setting.value.strip():
        return setting.value.strip(), True
    return date.today().strftime("%Y-%m-%d"), False


def set_simulated_today(db: Session, date_str: Optional[str]) -> Tuple[str, bool]:
    setting = db.query(AppSetting).filter(AppSetting.key == SETTING_KEY).first()
    if not setting:
        setting = AppSetting(key=SETTING_KEY, value=None)
        db.add(setting)

    if date_str and date_str.strip():
        # Validate format
        val = date_str.strip()
        datetime.strptime(val, "%Y-%m-%d")  # raises ValueError if invalid
        setting.value = val
        db.commit()
        return val, True
    else:
        setting.value = None
        db.commit()
        return date.today().strftime("%Y-%m-%d"), False
