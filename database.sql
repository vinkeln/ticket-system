CREATE DATABASE IF NOT EXISTS ticket_system;
USE ticket_system;

-- Ta bort befintliga tabeller om de finns, i en logisk ordning för att undvika beroendeproblem.
DROP TABLE IF EXISTS ticket_categories;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS ticket_assignments;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS knowledge_base;
DROP TABLE IF EXISTS status;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS teams;

-- 1. Skapa Teams: Det är viktigt att ha team innan kategorier och biljetter eftersom de refereras i andra tabeller.
CREATE TABLE teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

-- Lägg till standardvärden i teams-tabellen
INSERT INTO teams (name) VALUES
('IT Support'),
('HR Support'),
('Finance Support'),
('Other');

-- 2. Skapa Användare (Users) och Roller (Roles):
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role ENUM('user', 'agent', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Lägg till roller i roller-tabellen
INSERT INTO roles (name) VALUES ('user'), ('agent'), ('admin');

-- Skapa pivot-tabellen för att tilldela flera roller till användare
CREATE TABLE user_roles (
    user_id VARCHAR(255),
    role_id INT,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- 3. Skapa Status-tabellen:
CREATE TABLE status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- Lägg till statusvärden för biljetterna
INSERT INTO status (name) VALUES
('open'),
('closed');

-- 4. Skapa Kategorier (Categories):
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    team_id INT, -- Relation till teamet
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- Lägg till standardvärden för kategorier med team_id
INSERT INTO categories (name, description, team_id) VALUES
('Support', 'General IT support category', 1),
('HR Assistance', 'Human resources support category', 2),
('Finance Inquiry', 'Finance-related support category', 3);

-- 5. Skapa Tickets-tabellen:
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status_id INT, -- Relation till en "status"-tabell
    category_id INT, -- Relation till en "category"-tabell
    user_id VARCHAR(255), -- Relation till användaren som skapat biljetten
    agent_id VARCHAR(255), -- Relation till agenten som är tilldelad biljetten
    files LONGBLOB, -- Lagra filer och bilder som BLOB
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    team_id INT, -- Relation till teamet
    is_viewed BOOLEAN DEFAULT 0,
    FOREIGN KEY (status_id) REFERENCES status(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (agent_id) REFERENCES users(id),
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- 6. Skapa Ticket Assignments: Koppling mellan biljetter och agenter.
CREATE TABLE ticket_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT,
    agent_id VARCHAR(255),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (agent_id) REFERENCES users(id)
);

-- 7. Skapa Documents-tabellen:
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT,
    file_name VARCHAR(255),
    file_path VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

-- 8. Skapa Comments-tabellen:
CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT,
    user_id VARCHAR(255),
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 9. Skapa Knowledge Base:
CREATE TABLE knowledge_base (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    agent_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id)
);

-- 10. Skapa Ticket-Categories relationstabell (junction table):
CREATE TABLE ticket_categories (
    ticket_id INT,
    category_id INT,
    PRIMARY KEY (ticket_id, category_id),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
