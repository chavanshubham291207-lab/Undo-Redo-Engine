#include <iostream>
#include <stack>
#include <vector>
#include <string>
#include <sstream>

using namespace std;

#define SIZE 5

vector<int> s;
stack<vector<int>> undoStack, redoStack;

void saveState() {
    undoStack.push(s);

    while (!redoStack.empty())
        redoStack.pop();
}

void printStateJSON(const string& status, const string& message, const string& action = "") {
    cout << "{\"status\":\"" << status << "\",\"message\":\"" << message << "\",\"action\":\"" << action << "\",";
    cout << "\"capacity\":" << SIZE << ",";
    cout << "\"size\":" << s.size() << ",";
    cout << "\"undoCount\":" << undoStack.size() << ",";
    cout << "\"redoCount\":" << redoStack.size() << ",";
    cout << "\"stack\":[";
    for (size_t i = 0; i < s.size(); ++i) {
        cout << s[i] << (i + 1 < s.size() ? "," : "");
    }
    cout << "]}" << endl;
    cout.flush();
}

void push(int x) {
    if (s.size() == SIZE) {
        printStateJSON("OVERFLOW", "Stack Overflow! Maximum capacity (5) reached.", "PUSH");
    } else {
        saveState();
        s.push_back(x);
        printStateJSON("SUCCESS", "Element " + to_string(x) + " pushed", "PUSH");
    }
}

void pop() {
    if (s.empty()) {
        printStateJSON("UNDERFLOW", "Stack Underflow! Stack is empty.", "POP");
    } else {
        saveState();
        int val = s.back();
        s.pop_back();
        printStateJSON("SUCCESS", "Deleted element: " + to_string(val), "POP");
    }
}

void display() {
    printStateJSON("SUCCESS", "Current stack state retrieved", "STATE");
}

void undo() {
    if (undoStack.empty()) {
        printStateJSON("ERROR", "Nothing to undo", "UNDO");
    } else {
        redoStack.push(s);
        s = undoStack.top();
        undoStack.pop();
        printStateJSON("SUCCESS", "Undo performed", "UNDO");
    }
}

void redo() {
    if (redoStack.empty()) {
        printStateJSON("ERROR", "Nothing to redo", "REDO");
    } else {
        undoStack.push(s);
        s = redoStack.top();
        redoStack.pop();
        printStateJSON("SUCCESS", "Redo performed", "REDO");
    }
}

void reset() {
    s.clear();
    while (!undoStack.empty()) undoStack.pop();
    while (!redoStack.empty()) redoStack.pop();
    printStateJSON("SUCCESS", "Stack initialized", "RESET");
}

// Interactive terminal menu mode (original user interface)
void runInteractiveMenu() {
    int ch, x;
    do {
        cout << "\n\n1. Push";
        cout << "\n2. Pop";
        cout << "\n3. Display";
        cout << "\n4. Undo";
        cout << "\n5. Redo";
        cout << "\n6. Exit";
        cout << "\nEnter choice: ";
        if (!(cin >> ch)) break;

        switch (ch) {
            case 1:
                cout << "Enter element: ";
                cin >> x;
                push(x);
                break;
            case 2:
                pop();
                break;
            case 3:
                display();
                break;
            case 4:
                undo();
                break;
            case 5:
                redo();
                break;
            case 6:
                cout << "Exiting...\n";
                break;
            default:
                cout << "Invalid choice\n";
        }
    } while (ch != 6);
}

// API Stream mode for Node.js backend
void runApiMode() {
    // Initial state output
    printStateJSON("READY", "C++ Undo-Redo Engine Initialized", "INIT");

    string line;
    while (getline(cin, line)) {
        if (line.empty()) continue;
        stringstream ss(line);
        string cmd;
        ss >> cmd;

        if (cmd == "PUSH") {
            int x;
            if (ss >> x) {
                push(x);
            } else {
                printStateJSON("ERROR", "Invalid integer payload for PUSH", "PUSH");
            }
        } else if (cmd == "POP") {
            pop();
        } else if (cmd == "UNDO") {
            undo();
        } else if (cmd == "REDO") {
            redo();
        } else if (cmd == "STATE" || cmd == "DISPLAY") {
            display();
        } else if (cmd == "RESET") {
            reset();
        } else if (cmd == "EXIT") {
            break;
        } else {
            printStateJSON("ERROR", "Unknown command: " + cmd, "UNKNOWN");
        }
    }
}

int main(int argc, char* argv[]) {
    // Check if run in API mode by backend or default
    if (argc > 1 && string(argv[1]) == "--menu") {
        runInteractiveMenu();
    } else {
        runApiMode();
    }
    return 0;
}
