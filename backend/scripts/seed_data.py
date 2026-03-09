"""Seed the database with sample data for demo purposes."""
import os
import sys

import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.accounts.models import User


def seed():
    # Create demo user
    user, created = User.objects.get_or_create(
        email='demo@graphite.dev',
        defaults={
            'full_name': 'Demo User',
            'organization': 'Graphite Demo',
            'is_active': True,
        }
    )
    if created:
        user.set_password('demo1234')
        user.save()
        print(f"Created demo user: demo@graphite.dev / demo1234")
    else:
        print(f"Demo user already exists: demo@graphite.dev")

    print("\nSeed complete. Login with:")
    print("  Email: demo@graphite.dev")
    print("  Password: demo1234")
    print("\nUpload sample documents from data/sample/ via the UI.")


if __name__ == '__main__':
    seed()
