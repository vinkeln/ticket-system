// fil för funktioner

import mysql from 'mysql2/promise';
import fs from 'fs';

let login = fs.readFileSync('./config/credentials.json', 'utf8');

let credentials = JSON.parse(login);

let db;

(async function initializePool() {
    db = await mysql.createPool(credentials);
})();

async function createTicket(title, description, file, category) {
    const connection = await db.getConnection();
    await connection.beginTransaction(); // Börja en transaktion

    const ticketQuery = `INSERT INTO tickets (title, description, files, category_id) VALUES (?, ?, ?, ?)`;

    try {
        // Skapa biljetten med category_id
        const [ticketResult] = await connection.query(ticketQuery, [title, description, file, category]);
        const ticketId = ticketResult.insertId;

        await connection.commit(); // Bekräfta transaktionen
        return ticketId;
    } catch (error) {
        await connection.rollback(); // Återställ om något går fel
        console.error('Error creating ticket and associating category:', error);
        throw error;
    } finally {
        connection.release(); // Frigör anslutningen
    }
}


//jacobs funktion
const classifyTicket = (description) => {
    if (description.toLowerCase().includes("betalning") || description.toLowerCase().includes("faktura")) {
        return 1; // Kategori-ID för betalningar
    } else if (description.toLowerCase().includes("teknisk") || description.toLowerCase().includes("support")) {
        return 2; // Kategori-ID för tekniska frågor
    } else {
        return 3; // Standardkategori
    }
};

async function createCategory(name) {
    const query = 'INSERT INTO categories (name) VALUES (?)';
    const [result] = await db.query(query, [name]);
    return result.insertId; // Returnera ID för den skapade kategorin
    }

// Funktion för att hämta alla statusar
async function getStatuses() {
    const query = 'SELECT * FROM status';
    const [rows] = await db.query(query);
    return rows;
}

// Funktion för att hämta kategorier
async function getCategories() {
    const query = 'SELECT id, name FROM categories';
    //const query = 'SELECT * FROM categories';
    const [rows] = await db.query(query);
    return rows;
}

async function getTicketById(ticket_id) {
    const query = `
        SELECT t.*, 
               u.name AS agent_name, 
               c.comment, 
               c.created_at AS comment_date, 
               c.user_id AS commenter_id,
               commenter.name AS commenter_name,
               commenter.email AS commenter_email 
        FROM tickets t
        LEFT JOIN ticket_assignments ta ON t.id = ta.ticket_id
        LEFT JOIN users u ON ta.agent_id = u.id
        LEFT JOIN comments c ON t.id = c.ticket_id
        LEFT JOIN users commenter ON c.user_id = commenter.id
        WHERE t.id = ?;
    `;

    try {
        const [rows] = await db.query(query, [ticket_id]);
        console.log('Query result:', rows);
        if (rows.length === 0) {
            return null;
        }
        return rows; // Returnera alla rader som representerar olika kommentarer eller agentdata
    } catch (error) {
        console.error('Error fetching ticket by ID:', error);
        throw error;
    }
}


    /*async function getTicketById(ticket_id) {
        const query = `SELECT * FROM tickets WHERE id = ?`;
    
        try {
            const [rows] = await db.query(query, [ticket_id]); // mysql2/promise returnerar [rows, fields]
            console.log('Query result:', rows); // Logga resultatet av frågan
            if (rows.length === 0) {
                return null; // Om ingen biljett hittas, returnera null
            }
            return rows[0]; // Returnera den första raden från resultatet (där id är unikt)
        } catch (error) {
            console.error('Error fetching ticket by ID:', error);
            throw error; // Skicka vidare felet för att hantera det i andra delar av applikationen
        }
    }*/

    async function getFilteredTickets(category, status, description) {
        let query = 'SELECT * FROM tickets WHERE 1=1';
        const params = [];
    
        if (category) {
            query += ' AND category_id = ?';
            params.push(category);
        }
    
        if (status) {
            query += ' AND status_id = ?';
            params.push(status);
        }
    
        if (description) {
            query += ' AND description LIKE ?';
            params.push(`%${description}%`);
        }
    
        const [rows] = await db.query(query, params);
        return rows;
    }

    


export { createTicket, getTicketById, classifyTicket, createCategory, getCategories, getStatuses, getFilteredTickets };