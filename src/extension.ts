import * as vscode from 'vscode';
import fetch from 'node-fetch';


const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';


// Somali Python Explanation Dictionary
const somaliExplanations: { [key: string]: { simple: string, detailed: string } } = {
    'print': {
        simple: 'Waxay soo bandhigtaa qoraalka ama xogta shaashadda.',
        detailed: '`print()` waa function loo isticmaalo in lagu soo saaro (output) qoraal ama xog kale terminal-ka. Tusaale: `print("Hello Somali")`.'
    },
    'def': {
        simple: 'Waxaa loo isticmaalaa in lagu abuuro function cusub.',
        detailed: '`def` waa fure (keyword) loo isticmaalo in lagu qeexo function. Function waa qeyb code ah oo aad mar walba dib u isticmaali kartid.'
    },
    'if': {
        simple: 'Waxaa loo isticmaalaa in lagu hubiyo shardi.',
        detailed: '`if` waxaa loo isticmaalaa in lagu socodsiiyo code kaliya haddii shardi (condition) uu Run (True) noqdo.'
    },
    'else': {
        simple: 'Waxaa la socodsiiyaa haddii shardi-ga `if` uu noqdo Been.',
        detailed: '`else` waa qeyb ka mid ah `if` statement-ka, waxayna furantaa markii shuruudihii kale oo dhan ay Fashilmaan (False).'
    },
    'for': {
        simple: 'Waxaa loo isticmaalaa in lagu celceliyo code-ka (Loop).',
        detailed: '`for` loop waxaa loo isticmaalaa in lagu dul wareego (iterate) xog urursan sida List ama xarafyo.'
    },
    'while': {
        simple: 'Wuxuu celceliyaa code-ka inta shardi uu Run yahay.',
        detailed: '`while` loop wuxuu sii soconayaa inta shuruuda la siiyay ay tahay True.'
    },
    'import': {
        simple: 'Waxaa loo isticmaalaa in lagu soo dhoweeyo maktabado (libraries) kale.',
        detailed: '`import` wuxuu kuu ogolaanayaa inaad isticmaasho code ama function-no ay dad kale qoreen oo ku jira modules kale.'
    },
    'class': {
        simple: 'Waxaa loo isticmaalaa in lagu qeexo walax (Object).',
        detailed: '`class` waa naqshad (blueprint) loo isticmaalo in lagu abuuro Objects. Waa asaas-ka Programming-ka loo yaqaan OOP.'
    },
    'return': {
        simple: 'Wuxuu ka soo celiyaa natiijada function-ka.',
        detailed: '`return` waxaa loo isticmaalaa in function-ka uu dib u soo celiyo xog marka uu dhameysto shaqadiisa.'
    }
};

// Common Python Errors in Somali
const somaliErrors: { [key: string]: string } = {
    'SyntaxError': 'Waxaa jira qalad dhanka qorista code-ka ah. Hubi inay kuu dhan yihiin calaamadaha sida ( ), [ ], ama :.',
    'NameError': 'Magaca aad isticmaashay lama garanayo. Hubi haddii aad horey u qeexday variable-ka.',
    'IndentationError': 'Code-kaaga ma kala dhowa. Python waxay u baahan tahay in meelaha qaarkood la fogeeyo (Space).',
    'TypeError': 'Nooca xogta (data type) aad isticmaalayso ma ahan mid saxan shaqadan.',
    'IndexError': 'Waxaad isku deyaysaa inaad gaarto meel ka baxsan xadka List-ga.',
    'KeyError': 'Dictionary-ga kuma jiro furaha (key) aad raadinayso.'
};

export function activate(context: vscode.ExtensionContext) {
    console.log('Somali Python AI Teacher is now active!');

    // 1. Hover Provider
    const hoverProvider = vscode.languages.registerHoverProvider('python', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);
            const isBeginnerMode = vscode.workspace.getConfiguration('SomaliPythonTeacher').get('beginnerMode', true);

            if (somaliExplanations[word]) {
                const explanation = isBeginnerMode ? somaliExplanations[word].simple : somaliExplanations[word].detailed;
                const contents = new vscode.MarkdownString();
                contents.appendMarkdown(`**Somali Teacher Explanation:**\n\n`);
                contents.appendMarkdown(`${explanation}\n\n`);
                if (isBeginnerMode) {
                    contents.appendMarkdown(`*Tusaale:* \`${word} ...\``);
                }
                return new vscode.Hover(contents);
            }
            return null;
        }
    });

    // 2. Explain Selected Code Command
    const explainCommand = vscode.commands.registerCommand('somali-python-teacher.explainCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const text = editor.document.getText(selection);
            
            if (text) {
                const panel = vscode.window.createWebviewPanel(
                    'pythonSomaliTeacher',
                    'Python Somali Teacher',
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );

                panel.webview.html = getWebviewContent(text, "Fariin: AI-ga ayaa hadda diyaarinaya sharraxaadda...", "Loading...");

                try {
                    const aiExplanation = await explainCodeWithAI(text);
                    panel.webview.html = getWebviewContent(text, "Sharraxaadda Code-ka aad dooratay (AI):", aiExplanation);
                } catch (error) {
                    panel.webview.html = getWebviewContent(text, "Khalad ayaa dhacay!", "Waan ka xunnahay, AI-ga ma awoodin inuu sharraxo code-kan hadda. Fadlan isku day mar kale.");
                }
            } else {
                vscode.window.showInformationMessage('Fadlan marka hore dooro code-ka aad rabto in laguugu sharraxo.');
            }
        }
    });


    // 3. Open Learning Panel Command
    const openPanelCommand = vscode.commands.registerCommand('somali-python-teacher.openPanel', () => {
        const panel = vscode.window.createWebviewPanel(
            'pythonSomaliTeacher',
            'Python Somali Teacher',
            vscode.ViewColumn.One,
            {}
        );
        panel.webview.html = getWebviewContent("", "Ku soo dhowaaw qeybta barashada Python ee afka Soomaaliga.");
    });

    // 4. Diagnostic Listener (Error Explanation)
    let lastErrorLine = -1;
    const errorListener = vscode.languages.onDidChangeDiagnostics(async (event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'python') {
            const hasDocumentChanged = event.uris.some(u => u.toString() === editor.document.uri.toString());
            if (!hasDocumentChanged) {
                return;
            }

            const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            
            if (errors.length > 0) {
                const firstError = errors[0];
                const errorLine = firstError.range.start.line;
                
                // Only trigger if it's a new error or a new line to avoid spamming
                if (errorLine !== lastErrorLine) {
                    lastErrorLine = errorLine;
                    const errorMessage = firstError.message;
                    const codeLine = editor.document.lineAt(errorLine).text.trim();
                    
                    try {
                        const explanation = await explainPythonError(errorMessage, codeLine);
                        vscode.window.showInformationMessage(`🐍 Somali AI Teacher: ${explanation}`);
                    } catch (err) {
                        console.error('Error fetching AI explanation:', err);
                    }
                }
            } else {
                lastErrorLine = -1; // Reset if no errors
            }
        }
    });


    context.subscriptions.push(hoverProvider, explainCommand, openPanelCommand, errorListener);
}

interface OpenRouterResponse {
    choices?: {
        message?: {
            content?: string;
        };
    }[];
}

async function explainCodeWithAI(code: string): Promise<string> {
    try {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://github.com/SomaliDev/somali-python-teacher',
                'X-Title': 'Somali Python AI Teacher',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert Python teacher who explains code to beginners in Somali. Keep it simple, educational, and clear.'
                    },
                    {
                        role: 'user',
                        content: `Fadlan si kooban oo cad iigu sharrax code-kan Python-ka ah adiga oo isticmaalaya af-soomaali:\n\n\`\`\`python\n${code}\n\`\`\``
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as OpenRouterResponse;
        return data.choices?.[0]?.message?.content || "AI-ga wax sharraxaad ah ma soo celin.";
    } catch (error) {
        console.error('OpenRouter AI Error:', error);
        throw error;
    }
}


async function explainPythonError(errorMessage: string, codeLine: string): Promise<string> {
    try {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://github.com/SomaliDev/somali-python-teacher',
                'X-Title': 'Somali Python AI Teacher',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert Python teacher who explains errors to beginners in Somali. Keep it simple, educational, and helpful.'
                    },
                    {
                        role: 'user',
                        content: `Explain this Python error in Somali for a beginner developer and suggest how to fix it.\n\nError: ${errorMessage}\nCode Line: ${codeLine}`
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json() as OpenRouterResponse;
        return data.choices?.[0]?.message?.content || "Waan ka xunnahay, AI-gu ma bixin sharraxaad hadda.";
    } catch (error) {
        console.error('OpenRouter Error:', error);
        return "Xidhiidhka AI-ga ayaa go'an. Fadlan hubi internet-kaaga.";
    }
}


function getWebviewContent(code: string, intro: string, aiExplanation = "") {
    return `<!DOCTYPE html>
<html lang="so">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Python Somali Teacher</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; line-height: 1.6; background-color: #f8f9fa; color: #333; }
        .header { background: linear-gradient(135deg, #007acc 0%, #005a9e 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .section-title { color: #007acc; border-bottom: 2px solid #007acc; padding-bottom: 5px; margin-top: 30px; }
        .ai-content { background: white; padding: 20px; border-radius: 12px; border-left: 6px solid #28a745; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 25px; white-space: pre-line; }
        code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-family: 'Cascadia Code', Consolas, monospace; font-size: 0.9em; }
        pre { background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; overflow-x: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .tip-box { background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 8px; margin-top: 30px; }
        .loading { font-style: italic; color: #666; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Somali Python AI Teacher 🐍</h1>
        <p>${intro}</p>
    </div>
    
    ${code ? `<h3 class="section-title">Code-ka la soo doortay:</h3><pre><code>${code}</code></pre>` : ''}

    ${aiExplanation ? `
    <h3 class="section-title">Sharraxaadda AI-ga:</h3>
    <div class="ai-content ${aiExplanation === 'Loading...' ? 'loading' : ''}">
        ${aiExplanation}
    </div>` : ''}

    <div class="tip-box">
        <h4>💡 Talo:</h4>
        <p>AI-gu wuxuu kuu sharxi karaa logic kasta oo adag. Kaliya dooro code-ka, kadibna midigta (Right-Click) ku dhufo!</p>
    </div>
</body>
</html>`;
}


export function deactivate() {
    // Clean up extension resources if necessary
}
