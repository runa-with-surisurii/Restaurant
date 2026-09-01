# Inventory stock deduction fix

Stock must be deducted only when an order is confirmed. The confirm endpoint must resolve the branch inventory row by both branch and ingredient, use the recipe quantity multiplied by ordered quantity, convert units, update the existing inventory row, and create an idempotent inventory transaction.

This note documents the intended behavior while the backend implementation is being corrected.
