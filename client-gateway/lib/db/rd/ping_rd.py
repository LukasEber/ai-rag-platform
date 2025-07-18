import redis

r = redis.Redis.from_url(
    "redis://default:QyvNz6ZxfMZSLiC9UmYONRLl5QtT5r5p@redis-15671.c311.eu-central-1-1.ec2.redns.redis-cloud.com:15671"
)
try:
    print("Antwort:", r.ping())  # True = ok
except Exception as e:
    print("Fehler:", e)
