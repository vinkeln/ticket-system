-- Skapa databasen
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status_id INT, -- Relation till en "status"-tabell
    category_id INT, -- Relation till en "category"-tabell
    user_id INT, -- Relation till användaren som skapat biljetten
    agent_id INT, -- Relation till agenten som är tilldelad biljetten
    files VARBINARY(MAX), -- store files and images in the database as BLOB (max)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (status_id) REFERENCES status(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (agent_id) REFERENCES users(id)
);

-- Status för biljetter
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role EMUM('user', 'agent', 'admin') DEFAULT 'user', -- Definiera roller för systemet
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
);

-- Skapa kategorier för biljetter
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
)

-- Skapa status för biljetter
CREATE TABLE status (
    id INT
)
