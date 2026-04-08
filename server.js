const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());

// 🌐 CORS (permite abrir o front em outra porta, ex: Live Server :5500)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// 📁 LIBERAR PASTA DE UPLOAD PRA ACESSO
app.use('/uploads', express.static('uploads'));

// 📦 CONFIG UPLOAD
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// 🗄️ BANCO
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            email TEXT UNIQUE,
            senha TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS obras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            descricao TEXT,
            usuario_id INTEGER
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS arquivos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            caminho TEXT,
            obra_id INTEGER
        )
    `);
});


// ================= USUÁRIOS =================

// criar usuário
app.post('/usuarios', (req, res) => {
    const { nome, email, senha } = req.body;

    db.run(
        `INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)`,
        [nome, email, senha],
        function (err) {
            if (err) {
                return res.status(500).json({ erro: "Email já cadastrado" });
            }

            res.json({ id: this.lastID, nome, email });
        }
    );
});

// login
app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    db.get(
        `SELECT * FROM usuarios WHERE email = ? AND senha = ?`,
        [email, senha],
        (err, user) => {
            if (err) return res.status(500).json(err);
            if (!user) return res.status(401).json({ erro: "Credenciais inválidas" });

            res.json({ mensagem: "Login realizado", usuario: user });
        }
    );
});


// ================= OBRAS =================

// listar obras
app.get('/obras', (req, res) => {
    db.all(`
        SELECT obras.*, usuarios.nome as usuario_nome
        FROM obras
        JOIN usuarios ON obras.usuario_id = usuarios.id
    `, [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

// criar obra
app.post('/obras', (req, res) => {
    const { nome, descricao, usuario_id } = req.body;

    db.run(
        `INSERT INTO obras (nome, descricao, usuario_id) VALUES (?, ?, ?)`,
        [nome, descricao, usuario_id],
        function (err) {
            if (err) return res.status(500).json(err);

            res.json({
                id: this.lastID,
                nome,
                descricao,
                usuario_id
            });
        }
    );
});


// ================= UPLOAD =================

// enviar arquivo
app.post('/upload', upload.single('arquivo'), (req, res) => {

    const { obra_id } = req.body;

    if (!req.file) {
        return res.status(400).json({ erro: "Nenhum arquivo enviado" });
    }

    const nome = req.file.originalname;
    const caminho = req.file.path;

    db.run(
        `INSERT INTO arquivos (nome, caminho, obra_id) VALUES (?, ?, ?)`,
        [nome, caminho, obra_id],
        function (err) {
            if (err) return res.status(500).json(err);

            res.json({
                id: this.lastID,
                nome,
                caminho,
                obra_id
            });
        }
    );
});

// listar arquivos de uma obra
app.get('/obras/:id/arquivos', (req, res) => {
    const obra_id = req.params.id;

    db.all(
        `SELECT * FROM arquivos WHERE obra_id = ?`,
        [obra_id],
        (err, rows) => {
            if (err) return res.status(500).json(err);
            res.json(rows);
        }
    );
});


// 🚀 START
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
