import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, Loader2, MessageSquareText, RotateCcw, Send, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const starterMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I’m your AI assistant. I can help draft, summarize, brainstorm, and answer general questions. I can’t access or change CRM records in this version.",
};

const suggestions = [
  "Help me write a professional follow-up email",
  "Summarize the key points in a project update",
  "Give me a checklist for a customer site visit",
];
const apiBaseUrl = (import.meta.env.VITE_AI_API_URL || "").replace(/\/+$/, "");

export default function AIAssistant() {
  const { firebaseUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([starterMessage]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 4000 || sending || !firebaseUser) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setSending(true);

    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${apiBaseUrl}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: nextMessages.slice(-20).map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "The assistant couldn’t respond. Please try again.");
      }
      if (typeof payload?.message !== "string" || !payload.message.trim()) {
        throw new Error("The assistant returned an empty response. Please try again.");
      }
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: payload.message }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant couldn’t respond. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const startNewConversation = () => {
    setMessages([starterMessage]);
    setInput("");
    setError("");
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">AI Assistant</h1>
              <p className="text-sm text-muted-foreground">A helpful workspace for everyday questions</p>
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={startNewConversation} disabled={sending}>
          <RotateCcw className="mr-2 h-4 w-4" /> New conversation
        </Button>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
        <Card className="flex min-h-[520px] flex-col overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Bot className="h-4 w-4" /></span>
              <div>
                <CardTitle className="text-sm">Avira AI</CardTitle>
                <p className="text-xs text-muted-foreground">Ready to help</p>
              </div>
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
              </span>
            </div>
          </CardHeader>

          <div ref={conversationRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
            {messages.map((message) => {
              const fromUser = message.role === "user";
              return (
                <div key={message.id} className={`flex items-start gap-3 ${fromUser ? "flex-row-reverse" : ""}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${fromUser ? "bg-slate-200 text-slate-700" : "bg-blue-100 text-blue-700"}`}>
                    {fromUser ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </span>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${fromUser ? "rounded-tr-sm bg-blue-600 text-white" : "rounded-tl-sm bg-slate-100 text-slate-800"}`}>
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Bot className="h-4 w-4" /></span>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t bg-white p-3 sm:p-4">
            {error && (
              <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question… (Enter to send, Shift+Enter for a new line)"
                className="min-h-[48px] max-h-36 resize-y rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white"
                maxLength={4000}
                disabled={sending}
                aria-label="Message the AI assistant"
              />
              <Button type="submit" size="icon" className="h-12 w-12 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700" disabled={sending || !input.trim()} aria-label="Send message">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
              <span>Don’t share sensitive personal or customer information.</span>
              <span className={input.length > 3800 ? "text-amber-700" : ""}>{input.length}/4000</span>
            </div>
          </div>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <MessageSquareText className="h-4 w-4 text-blue-600" /> Try asking
              </div>
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={sending}
                    onClick={() => void sendMessage(suggestion)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs leading-5 text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-100 bg-blue-50/60 shadow-none">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900">
                <ShieldCheck className="h-4 w-4" /> Privacy & access
              </div>
              <p className="text-xs leading-5 text-blue-900/75">Your signed-in account is required. This assistant cannot access or change CRM records. This conversation is cleared when you leave or refresh this page.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
