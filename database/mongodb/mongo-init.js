const ROOT = process.env.MONGO_INITDB_ROOT_USERNAME;
const PASSWORD = process.env.MONGO_INITDB_ROOT_PASSWORD;
db = db.getSiblingDB('admin')
db.auth(ROOT, PASSWORD)

db = db.getSiblingDB('human_ressources');

db.createCollection('ab_drive_config');

db.createCollection('candidate_avatars');
db['candidate_avatars'].createIndex({
  "candidate_id": 1
});

db.createCollection('candidate_history');
db['candidate_history'].createIndex({
  "candidate_id": 1
});

db.createCollection('candidates');
db['candidates'].createIndex({
  "created_at": -1,
  "_id": 1
});

db.createCollection('drive_folder_config');

db.createCollection('jobs');

db.createCollection('mail_signatures');
db['mail_signatures'].createIndex({
  "user_id": 1
});

db.createCollection('mail_templates');
db['mail_templates'].createIndex({
  "user_id": 1
});
db['mail_templates'].createIndex({
  "user_id": 1,
  "scope": 1
});
db['mail_templates'].createIndex({
  "scope": 1,
  "peda_level": 1
});

db.createCollection('needs_analysis');

db.createCollection('notifications');
db['notifications'].createIndex({
  "user_id": 1
});
db['notifications'].createIndex({
  "created_at": 1
});

db.createCollection('offers');
db['offers'].createIndex({
  "needs_analysis_id": 1
});
