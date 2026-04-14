CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner VARCHAR(255),
    commercial VARCHAR(255),
    legal_referent VARCHAR(255),
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address VARCHAR(500),
    sector VARCHAR(255),
    job_description VARCHAR(500),
    siret CHAR(14) UNIQUE,
    idcc VARCHAR(50),
    notes TEXT,
    conclusion TEXT
);

CreateUser {
  createUser(input: {
    name: "Sophie Martin"
    email: "sophie@example.com"
    role: USER
  }) {
    id
    name
    email
    role
    createdAt
  }
}