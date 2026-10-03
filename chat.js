// WebLLM Implementation for Chrome Extension with Local Model
import * as webllm from './webllm.js';

let engine;
let isLoading = false;
let isModelReady = false;

// Intercept fetch requests to redirect to local model files
const originalFetch = window.fetch;
window.fetch = function(url, options) {
    // Redirect HuggingFace model requests to local files
    if (url && url.includes('huggingface.co') && url.includes('Qwen2.5-0.5B-Instruct-q4f16_1-MLC')) {
        const filename = url.split('/').pop();
        const localUrl = chrome.runtime.getURL(`models/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/${filename}`);
        console.log(`Redirecting model request from ${url} to ${localUrl}`);
        return originalFetch(localUrl, options);
    }
    
    // Redirect ndarray-cache.json requests
    if (url && url.includes('ndarray-cache.json')) {
        const localUrl = chrome.runtime.getURL('models/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/ndarray-cache.json');
        return originalFetch(localUrl, options);
    }
    
    // Redirect tensor-cache.json requests
    if (url && url.includes('tensor-cache.json')) {
        const localUrl = chrome.runtime.getURL('models/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/tensor-cache.json');
        return originalFetch(localUrl, options);
    }
    
    return originalFetch(url, options);
};

async function loadModel() {
    if (isLoading || isModelReady) return;
    
    isLoading = true;
    
    try {
        // Define the tiny model we want
        const selectedModel = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

        console.log("Initializing WebLLM with local model:", selectedModel);
        
        // Use a custom init progress callback to show loading status
        const initProgressCallback = (report) => {
            console.log(report.text);
            // Update UI with loading progress
            const modelStatus = document.getElementById('modelStatus');
            if (modelStatus) {
                modelStatus.textContent = report.text || 'Loading...';
                modelStatus.style.color = '#f59e0b';
            }
        };

        // Initialize the engine with local model
        engine = await webllm.CreateMLCEngine(
            selectedModel,
            { 
                initProgressCallback: initProgressCallback,
                logLevel: "INFO",
                useWebWorker: false
            }
        );
        
        console.log("WebLLM Engine Ready with Local Model!");
        isModelReady = true;
        
        // Update UI
        const modelStatus = document.getElementById('modelStatus');
        if (modelStatus) {
            modelStatus.textContent = 'Ready (Offline)';
            modelStatus.style.color = '#10b981';
        }
        
        // Add ready message
        if (window.addMessage) {
            window.addMessage('assistant', '✅ WebLLM engine loaded successfully with local model! Running completely offline without any downloads.');
        }
        
        return true;
    } catch (error) {
        console.error('Failed to load WebLLM engine:', error);
        
        // Update UI with error
        const modelStatus = document.getElementById('modelStatus');
        if (modelStatus) {
            modelStatus.textContent = 'Error';
            modelStatus.style.color = '#ef4444';
        }
        
        if (window.addMessage) {
            window.addMessage('assistant', `❌ Error loading WebLLM: ${error.message}\n\nThe model files are bundled with the extension, so no internet connection is needed.`);
        }
        
        return false;
    } finally {
        isLoading = false;
    }
}

async function generateResponse(userPrompt) {
    if (!engine || !isModelReady) {
        throw new Error('Model not loaded yet. Please wait for the engine to initialize.');
    }
    
    try {
        const messages = [
            { role: "system", content: "You are a helpful, lightweight AI assistant running locally in the Chrome extension using WebLLM with a bundled model." },
            { role: "user", content: userPrompt }
        ];

        const reply = await engine.chat.completions.create({
            messages,
            temperature: 0.7,
            max_tokens: 500, // Qwen-0.5B has a smaller context window
        });

        return reply.choices[0].message.content || "I apologize, but I couldn't generate a response.";
    } catch (error) {
        console.error('Generation error:', error);
        throw error;
    }
}

// Chat Interface
class ChatInterface {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.modelStatus = document.getElementById('modelStatus');
        
        this.isGenerating = false;
        
        // Make functions globally available
        window.addMessage = this.addMessage.bind(this);
        window.addTypingMessage = this.addTypingMessage.bind(this);
        
        this.initEventListeners();
        this.loadModel();
    }
    
    initEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });
    }
    
    async loadModel() {
        this.modelStatus.textContent = 'Initializing...';
        this.modelStatus.style.color = '#f59e0b';
        
        // Show first run progress indicator
        const progressDiv = document.getElementById('firstRunProgress');
        if (progressDiv) {
            progressDiv.style.display = 'block';
        }
        
        // Start a progress animation
        let progressStep = 0;
        const progressSteps = [
            '🔄 Loading AI engine...',
            '📦 Unpacking model files...',
            '⚡ Initializing neural network...',
            '🧠 Setting up AI brain...',
            '🔒 Creating secure environment...',
            '✨ Almost ready...'
        ];
        
        const progressInterval = setInterval(() => {
            const progressTexts = progressDiv?.querySelectorAll('p');
            if (progressTexts && progressStep < progressSteps.length) {
                progressTexts[0].textContent = progressSteps[progressStep];
                progressStep++;
            }
        }, 10000); // Update every 10 seconds (approximately 1 minute total)
        
        // Clear any existing messages except the welcome
        this.chatMessages.innerHTML = `
            <div class="message assistant">
                <div class="message-content">
                    <p>👋 Welcome to Local GPT!</p>
                    <p>This is your first time running the extension. The AI model needs to be initialized, which takes about <strong>1 minute</strong> on the first run.</p>
                    <p>⏳ Please wait while I prepare everything for you...</p>
                    <div id="firstRunProgress" style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; display: block;">
                        <p style="margin: 5px 0;">🔄 Loading AI engine...</p>
                        <p style="margin: 5px 0;">⚡ Initializing neural network...</p>
                        <p style="margin: 5px 0;">🔒 Setting up private environment...</p>
                    </div>
                </div>
            </div>
            <div id="readyMessage" class="message assistant" style="display: none;">
                <div class="message-content">
                    <p>✅ All set! I'm ready to help you.</p>
                    <p>💡 <strong>Try saying "Hi" to get started!</strong></p>
                    <p>Remember: I run completely in your browser, so your conversations stay private.</p>
                </div>
            </div>
        `;
        
        const success = await loadModel();
        
        // Clear the progress interval
        clearInterval(progressInterval);
        
        if (success) {
            // Hide the progress indicator
            const progressDivNew = document.getElementById('firstRunProgress');
            if (progressDivNew) {
                progressDivNew.style.display = 'none';
            }
            
            // Show the ready message
            const readyMessage = document.getElementById('readyMessage');
            if (readyMessage) {
                readyMessage.style.display = 'block';
            }
            
            // Add a completion message with the existing info
            setTimeout(() => {
                this.addMessage('assistant', '🚀 WebLLM engine loaded successfully with local model! Running completely offline without any downloads.');
            }, 500);
        }
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message || this.isGenerating) return;
        
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        
        this.addMessage('user', message);
        
        this.isGenerating = true;
        this.loadingIndicator.style.display = 'flex';
        this.sendButton.disabled = true;
        
        try {
            const response = await generateResponse(message);
            this.addTypingMessage('assistant', response);
        } catch (error) {
            console.error('Generation error:', error);
            this.addMessage('assistant', `Error: ${error.message}\n\nThe extension is running in offline mode with a bundled model.`);
        } finally {
            this.isGenerating = false;
            this.loadingIndicator.style.display = 'none';
            this.sendButton.disabled = false;
        }
    }
    
    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const paragraph = document.createElement('p');
        paragraph.textContent = content;
        messageContent.appendChild(paragraph);
        
        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);
        
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    addTypingMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const paragraph = document.createElement('p');
        messageContent.appendChild(paragraph);
        
        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);
        
        this.typeText(paragraph, content);
        
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    typeText(element, text) {
        let index = 0;
        const speed = 20;
        
        const type = () => {
            if (index < text.length) {
                element.textContent += text[index];
                index++;
                setTimeout(type, speed);
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
        };
        
        type();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatInterface();
});