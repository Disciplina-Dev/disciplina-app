-- Add company_history table to track changes to company records.
-- Each update to a company record creates a new history entry with the changed
-- column names and the company's status at that time.

USE disciplina;

CREATE TABLE IF NOT EXISTS company_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_column TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE
);
