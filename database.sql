CREATE DATABASE IF NOT EXISTS ticket_system;

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS status;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS ticket_assignments;
DROP TABLE IF EXISTS knowledge_base;
DROP TABLE IF EXISTS ticket_categories; --junction table

-- Users: Hanterar användare, agenter och adminroller.
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role ENUM('user', 'agent', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status: Lagrar olika statusar för biljetter.
CREATE TABLE status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- Lägg till statusvärde för biljetterna
INSERT INTO status (name) VALUES
('open'),
('closed');

-- Categories: Lagrar kategorier för biljetter (t.ex. mjukvara, hårdvara).
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

-- Tickets: Lagrar alla biljetter som skapas.
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status_id INT, -- Relation till en "status"-tabell
    category_id INT, -- Relation till en "category"-tabell
    user_id INT, -- Relation till användaren som skapat biljetten
    agent_id INT, -- Relation till agenten som är tilldelad biljetten
    files LONGBLOB, -- store files and images in the database as BLOB (max)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (status_id) REFERENCES status(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (agent_id) REFERENCES users(id)
);

--Documents: Lagrar metadata för uppladdade filer (filnamn och sökväg).
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT, -- Relation till en biljett
    file_name VARCHAR(255),
    file_path VARCHAR(255), -- lagras som en filväg(URL) på servern
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) -- Biljetten som dokumentet tillhör
);

--Comments: Hanterar kommentarer och uppdateringar för biljetter.
CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT, -- relation till en biljett
    user_id INT, -- relation till användaren eller agenten som skrev kommentaren
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Ticket_Assignments: Håller reda på vilken agent som är tilldelad en biljet
CREATE TABLE ticket_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY, -- unikt id för tilldelning
    ticket_id INT, -- relation till en biljett
    agent_id INT, -- relation till en agent
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- när biljetten tilldelades
    FOREIGN KEY (ticket_id) REFERENCES tickets(id), -- biljetten som tilldelades
    FOREIGN KEY (agent_id) REFERENCES users(id) -- agenten som tilldelades biljetten
);

CREATE TABLE ticket_categories (
    ticket_id INT,
    category_id INT,
    PRIMARY KEY (ticket_id, category_id),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE knowledge_base (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    agent_id INT, -- Referens till agenten som skapade artikeln
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id)
);

ALTER TABLE knowledge_base MODIFY agent_id VARCHAR(255);
