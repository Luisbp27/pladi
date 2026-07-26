#!/usr/bin/env python3
"""Airflow init: create admin user with correct password hashing."""
import os
from flask import Flask
from werkzeug.security import generate_password_hash
from airflow.utils.db import provide_session
from airflow.providers.fab.auth_manager.models import User, Role

# Create minimal Flask app with FAB config
os.environ["AIRFLOW__CORE__UNIT_TEST_MODE"] = "True"
app = Flask(__name__)
app.config["SECRET_KEY"] = "pladi-init"
app.config["FAB_PASSWORD_HASH_METHOD"] = "scrypt"


@provide_session
def create_admin(session=None):
    with app.app_context():
        pw_hash = generate_password_hash("admin", method="scrypt")

        role = session.query(Role).filter_by(name="Admin").first()
        if not role:
            role = Role(id=1, name="Admin")
            session.add(role)
            session.flush()

        user = session.query(User).filter_by(username="admin").first()
        if not user:
            user = User(
                id=1,
                username="admin",
                email="admin@pladi.com",
                first_name="Admin",
                last_name="User",
                password=pw_hash,
                active=True,
            )
            user.roles = [role]
            session.add(user)
            session.commit()
            print(f"Admin user created (scrypt hash)")


if __name__ == "__main__":
    create_admin()
