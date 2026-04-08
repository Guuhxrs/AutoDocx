const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());

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
app.post('/usuarios', async (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: "Preencha todos os campos" });
    }

    if (!validator.isEmail(email)) {
        return res.status(400).json({ erro: "E-mail inválido" });
    }

    try {
        const hash = await bcrypt.hash(senha, 10);

        db.run(
            `INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)`,
            [nome, email, hash],
            function (err) {
                if (err) {
                    return res.status(500).json({ erro: "Email já cadastrado" });
                }

                res.json({ id: this.lastID, nome, email });
            }
        );
    } catch (error) {
        console.error(error);
        return res.status(500).json({ erro: "Erro ao criar usuário" });
    }
});

// login
app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    db.get(
        `SELECT * FROM usuarios WHERE email = ?`,
        [email],
        async (err, user) => {
            if (err) return res.status(500).json(err);
            if (!user) return res.status(401).json({ erro: "Credenciais inválidas" });

            const valid = await bcrypt.compare(senha, user.senha);
            if (!valid) return res.status(401).json({ erro: "Credenciais inválidas" });

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