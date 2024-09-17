import mysql from 'mysql';
import fs from 'fs';

let login = fs.readFileSync('./config/credentials.json', 'utf8');

let credentials = JSON.parse(login);

let db;

(async function initializePool() {
    db = await mysql.createPool(credentials);
}) ();

async function createTicket(title, description, files) {
    const query = `INSERT INTO tickets (title, description, files) VALUES (?, ?, ?)`;
    await db.query(query, [title, description, files]);
}

export { createTicket };