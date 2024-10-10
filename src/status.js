import db from './db.js'; // Importera databasanslutningen

export async function getStatuses() {
    const query = 'SELECT * FROM status'; // SQL-fråga för att hämta alla statusar
    const [rows] = await db.query(query); // Kör frågan
    return rows; // Returnera raderna (alla statusar)
}
