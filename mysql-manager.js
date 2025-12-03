// ✅ MySQL Database Manager
// Gerencia conexão e operações com MySQL

const mysql = require('mysql2/promise');

class MySQLManager {
    constructor(config) {
        this.config = {
            host: config.host,
            user: config.user,
            password: config.password,
            database: config.database,
            port: config.port || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        };

        this.pool = null;
        this.isConnected = false;
        console.log('🔧 MySQL Manager inicializado');
    }

    // ✅ Conectar ao banco
    async connect() {
        try {
            this.pool = mysql.createPool(this.config);

            // Testar conexão
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();

            this.isConnected = true;
            console.log('✅ MySQL conectado com sucesso!');
            console.log(`📍 Database: ${this.config.database}`);
            console.log(`🌍 Host: ${this.config.host}\n`);

            return true;
        } catch (error) {
            this.isConnected = false;
            console.error('❌ Erro ao conectar MySQL:', error.message);
            throw error;
        }
    }

    // ✅ Executar query
    async query(sql, params = []) {
        if (!this.isConnected) {
            throw new Error('MySQL não está conectado');
        }

        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('❌ Erro na query:', error.message);
            console.error('SQL:', sql);
            throw error;
        }
    }

    // ========== PEOPLE ==========

    async getAllPeople() {
        const rows = await this.query('SELECT name FROM people ORDER BY name');
        return rows.map(row => row.name);
    }

    async addPerson(name) {
        await this.query('INSERT INTO people (name) VALUES (?)', [name]);
        return { success: true, name };
    }

    async removePerson(name) {
        await this.query('DELETE FROM people WHERE name = ?', [name]);
        return { success: true, name };
    }

    async personExists(name) {
        const rows = await this.query('SELECT COUNT(*) as count FROM people WHERE name = ?', [name]);
        return rows[0].count > 0;
    }

    // ========== PAID DATES ==========

    async getAllPaidDates() {
        const rows = await this.query('SELECT date, person_name FROM paid_dates ORDER BY date');
        const paidDates = {};
        rows.forEach(row => {
            const dateStr = row.date.toISOString().split('T')[0];
            paidDates[dateStr] = row.person_name;
        });
        return paidDates;
    }

    async addPaidDate(date, personName) {
        await this.query(
            'INSERT INTO paid_dates (date, person_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE person_name = ?',
            [date, personName, personName]
        );
        return { success: true, date, personName };
    }

    async removePaidDate(date) {
        await this.query('DELETE FROM paid_dates WHERE date = ?', [date]);
        return { success: true, date };
    }

    async getPaidDatesByPerson(personName) {
        const rows = await this.query(
            'SELECT date FROM paid_dates WHERE person_name = ? ORDER BY date DESC',
            [personName]
        );
        return rows.map(row => row.date.toISOString().split('T')[0]);
    }

    async getPaidDatesCount(personName = null) {
        if (personName) {
            const rows = await this.query(
                'SELECT COUNT(*) as count FROM paid_dates WHERE person_name = ?',
                [personName]
            );
            return rows[0].count;
        } else {
            const rows = await this.query('SELECT COUNT(*) as count FROM paid_dates');
            return rows[0].count;
        }
    }

    // ========== CHAT ==========

    async getAllChatMessages(limit = 100) {
        const rows = await this.query(
            'SELECT id, user_name, message, timestamp FROM chat ORDER BY timestamp DESC LIMIT ?',
            [limit]
        );
        return rows.reverse().map(row => ({
            id: row.id.toString(),
            userName: row.user_name,
            text: row.message,
            timestamp: row.timestamp.toISOString()
        }));
    }

    async addChatMessage(userName, message) {
        const result = await this.query(
            'INSERT INTO chat (user_name, message) VALUES (?, ?)',
            [userName, message]
        );
        return {
            id: result.insertId.toString(),
            userName,
            text: message,
            timestamp: new Date().toISOString()
        };
    }

    async clearOldChatMessages(keepLast = 100) {
        await this.query(
            \`DELETE FROM chat WHERE id NOT IN (
                SELECT id FROM (
                    SELECT id FROM chat ORDER BY timestamp DESC LIMIT ?
                ) as keep_messages
            )\`,
            [keepLast]
        );
        return { success: true };
    }

    // ========== SETTINGS ==========

    async getSetting(key) {
        const rows = await this.query('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
        return rows.length > 0 ? rows[0].setting_value : null;
    }

    async setSetting(key, value) {
        await this.query(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, value, value]
        );
        return { success: true, key, value };
    }

    async getAllSettings() {
        const rows = await this.query('SELECT setting_key, setting_value FROM settings');
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        return settings;
    }

    // ========== ANALYTICS ==========

    async getStats() {
        const peopleCount = await this.query('SELECT COUNT(*) as count FROM people');
        const paidDatesCount = await this.query('SELECT COUNT(*) as count FROM paid_dates');
        const chatCount = await this.query('SELECT COUNT(*) as count FROM chat');

        return {
            people: peopleCount[0].count,
            paidDates: paidDatesCount[0].count,
            chatMessages: chatCount[0].count,
            timestamp: new Date().toISOString()
        };
    }

    async getTopContributors(limit = 5) {
        const rows = await this.query(
            \`SELECT person_name, COUNT(*) as count 
             FROM paid_dates 
             GROUP BY person_name 
             ORDER BY count DESC 
             LIMIT ?\`,
            [limit]
        );
        return rows.map(row => ({
            name: row.person_name,
            count: row.count
        }));
    }

    async getMonthlyStats() {
        const rows = await this.query(
            \`SELECT 
                DATE_FORMAT(date, '%Y-%m') as month,
                COUNT(*) as count
             FROM paid_dates
             GROUP BY month
             ORDER BY month DESC
             LIMIT 12\`
        );
        return rows;
    }

    // ========== HEALTH CHECK ==========

    async healthCheck() {
        try {
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();

            const stats = await this.getStats();

            return {
                status: '✅ Saudável',
                connected: this.isConnected,
                ...stats
            };
        } catch (error) {
            return {
                status: '❌ Erro',
                connected: false,
                error: error.message
            };
        }
    }

    // ✅ Fechar conexão
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('🛑 MySQL conexão fechada');
        }
    }
}

module.exports = MySQLManager;
