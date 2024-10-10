import mysql from 'mysql2/promise';
import fs from 'fs'; // Importera fs

// Här läser du in dina databasuppgifter
let login = fs.readFileSync('./config/credentials.json', 'utf8');
let credentials = JSON.parse(login);

const db = await mysql.createPool(credentials);  // Skapa en pool med databasanslutningar

// Exportera anslutningen så att den kan användas i andra filer
export default db;
