import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { ChatMessage } from '@/components/ChatMessage';
import { useAuth } from '@/hooks/useAuth';
import { getChatHistory, saveChatMessage, sendChatMessage } from '@/lib/api';
import type { ChatMessage as ChatMessageType } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

type BotType = 'marketing' | 'sales';

export default function ChatScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user, profile } = useAuth();
  const [activeBot, setActiveBot] = useState<BotType>('marketing');
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => { loadChatHistory(); }, [activeBot, user]);

  const loadChatHistory = async () => {
    if (!user) return;
    setLoading(true);
    try { const history = await getChatHistory(user.id, activeBot); setMessages(history); } catch (error) { console.error('Error loading chat history:', error); } finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user || sending) return;
    const userMessage = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      const savedUserMsg = await saveChatMessage(user.id, activeBot, userMessage, true);
      setMessages((prev) => [...prev, savedUserMsg]);
      setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 100);
      const aiResponse = await sendChatMessage(activeBot, userMessage, { appName: profile?.app_name, category: profile?.app_category });
      const savedAiMsg = await saveChatMessage(user.id, activeBot, aiResponse, false);
      setMessages((prev) => [...prev, savedAiMsg]);
      setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [...prev, { id: 'error', user_id: user.id, bot_type: activeBot, message: 'Sorry, I encountered an error. Please try again.', is_user: false, created_at: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  const formatTime = (dateStr: string): string => new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const botInfo = { marketing: { name: 'Marketing Bot', icon: 'megaphone-outline' as const, description: 'ASO, social media, growth hacking, content marketing' }, sales: { name: 'Sales Bot', icon: 'cash-outline' as const, description: 'Pricing, conversions, upsells, churn reduction' } };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={styles.header}><Text variant="title" weight="bold">AI Chat</Text></View>
        <View style={styles.botSelector}>
          {(['marketing', 'sales'] as const).map((bot) => (
            <TouchableOpacity key={bot} style={[styles.botTab, { backgroundColor: activeBot === bot ? colors.primary + '15' : 'transparent', borderColor: activeBot === bot ? colors.primary : colors.border }]} onPress={() => setActiveBot(bot)}>
              <Ionicons name={botInfo[bot].icon} size={20} color={activeBot === bot ? colors.primary : colors.textSecondary} />
              <Text variant="label" weight={activeBot === bot ? 'semibold' : 'regular'} color={activeBot === bot ? 'accent' : 'secondary'} style={styles.botTabText}>{botInfo[bot].name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Card style={styles.botInfoCard}><View style={styles.botInfoContent}><View style={[styles.botAvatar, { backgroundColor: colors.primary }]}><Ionicons name={botInfo[activeBot].icon} size={24} color="#FFFFFF" /></View><View style={styles.botInfoText}><Text variant="label" weight="semibold">{botInfo[activeBot].name}</Text><Text variant="caption" color="secondary">{botInfo[activeBot].description}</Text></View></View></Card>
        <ScrollView ref={scrollViewRef} style={styles.messagesContainer} contentContainerStyle={styles.messagesContent} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
          {loading ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View> : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
              <Text variant="body" color="secondary" align="center" style={styles.emptyText}>Start a conversation with your AI {activeBot} assistant</Text>
              <View style={styles.suggestions}>
                {activeBot === 'marketing' ? (<><SuggestionChip text="How can I improve my ASO?" onPress={() => setInputText('How can I improve my ASO?')} /><SuggestionChip text="Best social media strategies" onPress={() => setInputText('What are the best social media strategies for my app?')} /></>) : (<><SuggestionChip text="How should I price my app?" onPress={() => setInputText('How should I price my app?')} /><SuggestionChip text="How to reduce churn?" onPress={() => setInputText('What are the best ways to reduce churn?')} /></>)}
              </View>
            </View>
          ) : messages.map((msg) => <ChatMessage key={msg.id} message={msg.message} isUser={msg.is_user} timestamp={formatTime(msg.created_at)} />)}
          {sending && <View style={styles.typingIndicator}><ActivityIndicator size="small" color={colors.primary} /><Text variant="caption" color="secondary" style={{ marginLeft: 8 }}>Thinking...</Text></View>}
        </ScrollView>
        <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
          <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} placeholder={`Ask the ${activeBot} bot...`} placeholderTextColor={colors.textSecondary} value={inputText} onChangeText={setInputText} multiline maxLength={500} />
          <TouchableOpacity style={[styles.sendButton, { backgroundColor: inputText.trim() && !sending ? colors.primary : colors.border }]} onPress={handleSend} disabled={!inputText.trim() || sending}><Ionicons name="send" size={20} color={inputText.trim() && !sending ? '#FFFFFF' : colors.textSecondary} /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SuggestionChip({ text, onPress }: { text: string; onPress: () => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  return <TouchableOpacity style={[styles.suggestionChip, { backgroundColor: colors.primary + '15' }]} onPress={onPress}><Text variant="caption" color="accent">{text}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, keyboardView: { flex: 1 }, header: { paddingHorizontal: 16, paddingVertical: 16 }, botSelector: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 }, botTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 }, botTabText: { marginLeft: 8 }, botInfoCard: { marginHorizontal: 16, marginBottom: 16 }, botInfoContent: { flexDirection: 'row', alignItems: 'center' }, botAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, botInfoText: { flex: 1 }, messagesContainer: { flex: 1 }, messagesContent: { padding: 16, paddingBottom: 32 }, loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 }, emptyState: { alignItems: 'center', paddingTop: 48 }, emptyText: { marginTop: 16, marginBottom: 24, maxWidth: 250 }, suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }, suggestionChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }, typingIndicator: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }, inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 16, borderTopWidth: 1, gap: 12 }, input: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, maxHeight: 100 }, sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' } });
