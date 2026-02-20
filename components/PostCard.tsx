import React from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Text } from './ui/Text';
import { Colors } from '@/constants/Colors';
import type { CommunityPost } from '@/lib/supabase';

interface PostCardProps { post: CommunityPost; onPress: () => void; onLike: () => void; isLiked?: boolean; }

export function PostCard({ post, onPress, onLike, isLiked = false }: PostCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const formatDate = (dateStr: string): string => { const date = new Date(dateStr); const now = new Date(); const diffMs = now.getTime() - date.getTime(); const diffMins = Math.floor(diffMs / 60000); const diffHours = Math.floor(diffMs / 3600000); const diffDays = Math.floor(diffMs / 86400000); if (diffMins < 60) return `${diffMins}m ago`; if (diffHours < 24) return `${diffHours}h ago`; if (diffDays < 7) return `${diffDays}d ago`; return date.toLocaleDateString(); };
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.authorInfo}><View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}><Text variant="label" weight="semibold" color="accent">{post.profile?.full_name?.[0]?.toUpperCase() || 'A'}</Text></View><View><Text variant="label" weight="semibold">{post.profile?.full_name || 'Anonymous'}</Text><Text variant="caption" color="secondary">{formatDate(post.created_at)}</Text></View></View>
        {post.category && <View style={[styles.category, { backgroundColor: colors.primary + '15' }]}><Text variant="caption" color="accent" weight="medium">{post.category}</Text></View>}
      </View>
      <Text variant="subtitle" weight="semibold" style={styles.title}>{post.title}</Text>
      <Text variant="body" color="secondary" numberOfLines={3} style={styles.content}>{post.content}</Text>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.action} onPress={onLike}><Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? colors.error : colors.textSecondary} /><Text variant="caption" color={isLiked ? 'error' : 'secondary'} style={styles.actionText}>{post.likes_count}</Text></TouchableOpacity>
        <View style={styles.action}><Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} /><Text variant="caption" color="secondary" style={styles.actionText}>{post.comments_count}</Text></View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ card: { marginBottom: 12 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }, authorInfo: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, category: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }, title: { marginBottom: 8 }, content: { marginBottom: 16 }, footer: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E5' }, action: { flexDirection: 'row', alignItems: 'center', marginRight: 20 }, actionText: { marginLeft: 6 } });
