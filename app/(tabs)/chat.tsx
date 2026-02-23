import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { ChatMessage } from '@/components/ChatMessage';
import { LockedFeature } from '@/components/Paywall';
import { useAuth } from '@/hooks/useAuth';
import { getChatHistory, saveChatMessage, sendChatMessage } from '@/lib/api';
import type { ChatMessage as ChatMessageType } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

type BotType = 'marketing' | 'sales';

function TypingIndicator() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [dot1] = useState(new Animated.Value(0));
  const [dot2] = useState(new Animated.Value(0));
  const [dot3] = useState(new Animated.Value(0));

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }],
  });

  return (
    <View style={[styles.typingBubble, { backgroundColor: colors.card }]}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { backgroundColor: colors.textSecondary }, dotStyle(dot)]}
        />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, profile } = useAuth();
  const [activeBot, setActiveBot] = useState<BotType>('marketing');
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadChatHistory();
  }, [activeBot, user]);

  const loadChatHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const history = await getChatHistory(user.id, activeBot);
      setMessages(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user || sending) return;
    const userMessage = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      const savedUserMsg = await saveChatMessage(user.id, activeBot, userMessage, true);
      setMessages((prev) => [...prev, savedUserMsg]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

      const aiResponse = await sendChatMessage(activeBot, userMessage, {
        appName: profile?.app_name,
        category: profile?.app_category,
      });
      const savedAiMsg = await saveChatMessage(user.id, activeBot, aiResponse, false);
      setMessages((prev) => [...prev, savedAiMsg]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage = error.message || 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          user_id: user.id,
          bot_type: activeBot,
          message: errorMessage,
          is_user: false,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string): string =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const botInfo = {
    marketing: {
      name: 'Marketing',
      fullName: 'Marketing Assistant',
      icon: 'megaphone' as const,
      description: 'ASO, social media, growth hacking',
    },
    sales: {
      name: 'Sales',
      fullName: 'Sales Assistant',
      icon: 'cash' as const,
      description: 'Pricing, conversions, retention',
    },
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LockedFeature feature="aiChat" featureTitle="AI Chat Assistant">
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerContent}>
              <View style={[styles.headerAvatar, { backgroundColor: '#A78BFA' }]}>
                <Ionicons name={botInfo[activeBot].icon} size={20} color="#FFFFFF" />
              </View>
              <View style={styles.headerText}>
                <Text variant="label" weight="semibold">
                  {botInfo[activeBot].fullName}
                </Text>
                <Text variant="caption" color="secondary">
                  {botInfo[activeBot].description}
                </Text>
              </View>
            </View>

            {/* Bot Toggle */}
            <View style={[styles.botToggle, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
              {(['marketing', 'sales'] as const).map((bot) => (
                <TouchableOpacity
                  key={bot}
                  style={[
                    styles.botToggleButton,
                    activeBot === bot && { backgroundColor: '#A78BFA' },
                  ]}
                  onPress={() => setActiveBot(bot)}
                >
                  <Ionicons
                    name={botInfo[bot].icon}
                    size={16}
                    color={activeBot === bot ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    variant="caption"
                    weight="semibold"
                    style={{
                      marginLeft: 4,
                      color: activeBot === bot ? '#FFFFFF' : colors.textSecondary,
                    }}
                  >
                    {botInfo[bot].name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: '#A78BFA' + '20' }]}>
                  <Ionicons name={botInfo[activeBot].icon} size={32} color="#A78BFA" />
                </View>
                <Text variant="body" weight="semibold" style={styles.emptyTitle}>
                  Start a conversation
                </Text>
                <Text variant="caption" color="secondary" align="center" style={styles.emptyText}>
                  Ask me anything about {activeBot === 'marketing' ? 'marketing your app' : 'sales strategies'}
                </Text>
                <View style={styles.suggestions}>
                  {activeBot === 'marketing' ? (
                    <>
                      <SuggestionChip text="Improve my ASO" onPress={() => setInputText('How can I improve my ASO?')} />
                      <SuggestionChip text="Social media tips" onPress={() => setInputText('What social media strategies work best?')} />
                      <SuggestionChip text="Growth hacking" onPress={() => setInputText('Give me growth hacking ideas')} />
                    </>
                  ) : (
                    <>
                      <SuggestionChip text="Pricing strategy" onPress={() => setInputText('How should I price my app?')} />
                      <SuggestionChip text="Reduce churn" onPress={() => setInputText('How can I reduce churn?')} />
                      <SuggestionChip text="Upsell tactics" onPress={() => setInputText('What upselling tactics work best?')} />
                    </>
                  )}
                </View>
              </View>
            ) : (
              <>
                {messages.map((msg, index) => {
                  const prevMsg = messages[index - 1];
                  const showTail = !prevMsg || prevMsg.is_user !== msg.is_user;
                  const showTimestamp = index === messages.length - 1 ||
                    (messages[index + 1] && messages[index + 1].is_user !== msg.is_user);

                  return (
                    <ChatMessage
                      key={msg.id}
                      message={msg.message}
                      isUser={msg.is_user}
                      timestamp={showTimestamp ? formatTime(msg.created_at) : undefined}
                      showTail={showTail}
                    />
                  );
                })}
              </>
            )}
            {sending && (
              <View style={styles.typingContainer}>
                <TypingIndicator />
              </View>
            )}
          </ScrollView>

          {/* Input Area - iMessage Style */}
          <View style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Message..."
                placeholderTextColor={colors.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: inputText.trim() && !sending ? '#A78BFA' : 'transparent',
                  },
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={inputText.trim() && !sending ? '#FFFFFF' : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LockedFeature>
    </SafeAreaView>
  );
}

function SuggestionChip({ text, onPress }: { text: string; onPress: () => void }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  return (
    <TouchableOpacity
      style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <Text variant="caption" color="primary">{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  botToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  botToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },

  // Messages
  messagesContainer: { flex: 1 },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 4,
  },
  emptyText: {
    marginBottom: 24,
    maxWidth: 250,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },

  // Typing Indicator
  typingContainer: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Input Area
  inputContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    lineHeight: 22,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
