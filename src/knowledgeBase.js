import db from './db.js';

// Funktion för att skapa en ny artikel
export async function createArticle(title, content, agentId) {
    const query = 'INSERT INTO knowledge_base (title, content, agent_id) VALUES (?, ?, ?)';
    await db.query(query, [title, content, agentId]);
}

// Funktion för att hämta alla artiklar, eller söka efter artiklar baserat på ett sökord
export async function getArticles(search = '') {
    const query = 'SELECT * FROM knowledge_base WHERE title LIKE ? OR content LIKE ?';
    const [rows] = await db.query(query, [`%${search}%`, `%${search}%`]);
    return rows;
}

// Funktion för att hämta en specifik artikel baserat på dess ID
export async function getArticleById(id) {
    const query = 'SELECT * FROM knowledge_base WHERE id = ?';
    const [rows] = await db.query(query, [id]);
    return rows[0];
}

// Funktion för att ta bort en artikel baserat på dess ID
export async function deleteArticleById(id) {
    const query = 'DELETE FROM knowledge_base WHERE id = ?';
    await db.query(query, [id]);
}

