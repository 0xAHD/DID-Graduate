-- Bump max connections so two Cloud Agent instances can run concurrently
ALTER SYSTEM SET max_connections = 200;
