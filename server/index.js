import express from 'express';
import { createClient } from '@libsql/client';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const DB_PATH = 'database.sqlite';

// Check if database file exists and is corrupted
const checkAndInitializeDatabase = () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      try {
        const db = createClient({
          url: `file:${DB_PATH}`,
        });
        // Test the connection
        db.execute('SELECT 1');
      } catch (error) {
        console.log('Database corrupted, recreating...');
        fs.unlinkSync(DB_PATH);
      }
    }
  } catch (error) {
    console.error('Error checking database:', error);
  }
};

// Initialize express app
const app = express();

// Configure CORS with expanded options
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://localhost:5173',
    'http://127.0.0.1:7860',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true,
  preflightContinue: true
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Initialize database
const initializeDatabase = async () => {
  try {
    checkAndInitializeDatabase();
    
    const db = createClient({
      url: `file:${DB_PATH}`,
    });

    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        budget REAL NOT NULL,
        city TEXT NOT NULL,
        investment_type TEXT NOT NULL,
        target_audience TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

let db;

// Initialize database before starting server
const startServer = async () => {
  try {
    db = await initializeDatabase();

    // Save user data
    app.post('/api/user-data', async (req, res) => {
      try {
        const { budget, city, investmentType, targetAudience } = req.body;

        const result = await db.execute({
          sql: 'INSERT INTO user_data (budget, city, investment_type, target_audience) VALUES (?, ?, ?, ?)',
          args: [budget, city, investmentType, targetAudience]
        });
        
        const insertedData = await db.execute({
          sql: 'SELECT * FROM user_data WHERE id = ?',
          args: [result.lastInsertRowid]
        });
        
        res.json(insertedData.rows[0]);
      } catch (error) {
        console.error('Error saving user data:', error);
        res.status(500).json({ error: 'Failed to save user data' });
      }
    });

    // Get all user data
    app.get('/api/user-data', async (req, res) => {
      try {
        const result = await db.execute('SELECT * FROM user_data ORDER BY created_at DESC');
        res.json(result.rows);
      } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
      }
    });

    // Proxy endpoint for the AI API
    app.post('/api/proxy/ai', async (req, res) => {
      try {
        const { budget, city, investmentType, targetAudience } = req.body;
        
        console.log('Received request data:', {
          budget,
          city,
          investmentType,
          targetAudience
        });

        // Prepare the prompt for the AI
        const prompt = `Analise as seguintes informações para um novo negócio:
- Orçamento: R$ ${budget}
- Cidade: ${city}
- Tipo de Negócio: ${investmentType}
- Público-alvo: ${targetAudience}

Por favor, forneça recomendações detalhadas sobre a melhor localização para este negócio, considerando:
1. Áreas específicas da cidade que melhor atendem ao público-alvo
2. Análise do fluxo de pessoas e acessibilidade
3. Proximidade com estabelecimentos complementares
4. Considerações sobre o orçamento disponível
5. Potencial de crescimento da região`;

        // First, check if the AI service is available
        try {
          await fetch('http://127.0.0.1:7860/health-check');
        } catch (error) {
          throw new Error('AI service is not available. Please ensure the service is running.');
        }

        const response = await fetch(
          "http://127.0.0.1:7860/api/v1/run/cd2f8e48-cfa8-4a7c-871b-1a2218d69bf0?stream=false",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "sk-tjmcaGsj62BGA6iy-13F1Q9esTKx-4QLYb9u_TVL84k"
            },
            body: JSON.stringify({
              input_value: prompt,
              output_type: "chat",
              input_type: "chat",
              tweaks: {
                "Agent-paooE": {},
                "ChatInput-Q5FcW": {},
                "PythonFunction-x3mJW": {},
                "NVIDIAEmbeddingsComponent-tRTkt": {},
                "Chroma-dOhpM": {},
                "ChatOutput-GwK2m": {}
              }
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('AI API error response:', errorText);
          throw new Error(`AI API responded with status: ${response.status}`);
        }

        const data = await response.json();
        console.log('AI API response:', data);

        // Extract the message from the complex response structure
        let message;
        if (data.outputs && data.outputs[0] && data.outputs[0].outputs[0] && data.outputs[0].outputs[0].results && data.outputs[0].outputs[0].results.message) {
          message = data.outputs[0].outputs[0].results.message.data.text;
        } else if (data.message) {
          message = data.message;
        } else {
          message = "Desculpe, não foi possível processar a resposta neste momento.";
        }

        res.json({ message });
      } catch (error) {
        console.error('Error calling AI API:', error);
        res.status(500).json({ 
          error: 'Failed to process AI request', 
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Clean up on exit
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Start the server
startServer();