// MongoDB init script for the Identus Mediator
// Sets up the mediator database with the admin user.
db = db.getSiblingDB("mediator");
db.createUser({
  user: "admin",
  pwd: "admin",
  roles: [{ role: "readWrite", db: "mediator" }],
});
db.createCollection("messages");
db.createCollection("connections");
