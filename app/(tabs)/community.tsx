import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { PostCard } from '@/components/PostCard';
import { LockedFeature } from '@/components/Paywall';
import { useAuth } from '@/hooks/useAuth';
import { getCommunityPosts, createPost, likePost, unlikePost, checkIfLiked } from '@/lib/api';
import type { CommunityPost } from '@/lib/supabase';
import { Config } from '@/constants/Config';
import { Colors } from '@/constants/Colors';

export default function CommunityScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const fetchedPosts = await getCommunityPosts(selectedCategory || undefined);
      setPosts(fetchedPosts);
      if (user) { const likedSet = new Set<string>(); await Promise.all(fetchedPosts.map(async (post) => { const isLiked = await checkIfLiked(post.id, user.id); if (isLiked) likedSet.add(post.id); })); setLikedPosts(likedSet); }
    } catch (error) { console.error('Error loading posts:', error); } finally { setLoading(false); setRefreshing(false); }
  }, [selectedCategory, user]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleRefresh = () => { setRefreshing(true); loadPosts(); };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = likedPosts.has(postId);
    const newLikedPosts = new Set(likedPosts);
    const updatedPosts = posts.map((post) => post.id === postId ? { ...post, likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1 } : post);
    if (isLiked) newLikedPosts.delete(postId); else newLikedPosts.add(postId);
    setLikedPosts(newLikedPosts);
    setPosts(updatedPosts);
    try { if (isLiked) await unlikePost(postId, user.id); else await likePost(postId, user.id); } catch (error) { console.error('Error toggling like:', error); loadPosts(); }
  };

  const handleCreatePost = async () => {
    if (!user || !newPostTitle.trim() || !newPostContent.trim()) return;
    setCreating(true);
    try { await createPost(user.id, newPostTitle.trim(), newPostContent.trim(), newPostCategory || undefined); setShowCreateModal(false); setNewPostTitle(''); setNewPostContent(''); setNewPostCategory(null); loadPosts(); } catch (error: any) { console.error('Error creating post:', error); Alert.alert('Error', 'Failed to create post. Please try again.'); } finally { setCreating(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LockedFeature feature="community" featureTitle="Founder Community">
      <View style={styles.header}>
        <View><Text variant="title" weight="bold">Community</Text><Text variant="caption" color="secondary">Connect with fellow founders</Text></View>
        <TouchableOpacity style={[styles.createButton, { backgroundColor: colors.primary }]} onPress={() => setShowCreateModal(true)}><Ionicons name="add" size={24} color="#FFFFFF" /></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        <TouchableOpacity style={[styles.categoryChip, { backgroundColor: selectedCategory === null ? colors.primary : colors.card, borderColor: selectedCategory === null ? colors.primary : colors.border }]} onPress={() => setSelectedCategory(null)}><Text variant="label" style={{ color: selectedCategory === null ? '#FFFFFF' : colors.text }}>All</Text></TouchableOpacity>
        {Config.COMMUNITY_CATEGORIES.map((category) => <TouchableOpacity key={category} style={[styles.categoryChip, { backgroundColor: selectedCategory === category ? colors.primary : colors.card, borderColor: selectedCategory === category ? colors.primary : colors.border }]} onPress={() => setSelectedCategory(category)}><Text variant="label" style={{ color: selectedCategory === category ? '#FFFFFF' : colors.text }}>{category}</Text></TouchableOpacity>)}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.postsContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
        {posts.length === 0 && !loading ? <View style={styles.emptyState}><Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} /><Text variant="body" color="secondary" align="center" style={styles.emptyText}>No posts yet. Be the first to share!</Text></View> : posts.map((post) => <PostCard key={post.id} post={post} onPress={() => {}} onLike={() => handleLike(post.id)} isLiked={likedPosts.has(post.id)} />)}
      </ScrollView>
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateModal(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}><TouchableOpacity onPress={() => setShowCreateModal(false)}><Text variant="body" color="secondary">Cancel</Text></TouchableOpacity><Text variant="label" weight="semibold">New Post</Text><TouchableOpacity onPress={handleCreatePost} disabled={!newPostTitle.trim() || !newPostContent.trim() || creating}><Text variant="body" color={newPostTitle.trim() && newPostContent.trim() && !creating ? 'accent' : 'secondary'} weight="semibold">{creating ? 'Posting...' : 'Post'}</Text></TouchableOpacity></View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <TextInput style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]} placeholder="Title" placeholderTextColor={colors.textSecondary} value={newPostTitle} onChangeText={setNewPostTitle} maxLength={100} />
            <TextInput style={[styles.contentInput, { color: colors.text }]} placeholder="What's on your mind?" placeholderTextColor={colors.textSecondary} value={newPostContent} onChangeText={setNewPostContent} multiline textAlignVertical="top" />
            <Text variant="label" weight="semibold" style={styles.categoryLabel}>Category</Text>
            <View style={styles.categorySelector}>{Config.COMMUNITY_CATEGORIES.map((category) => <TouchableOpacity key={category} style={[styles.categorySelectorChip, { backgroundColor: newPostCategory === category ? colors.primary + '15' : colors.card, borderColor: newPostCategory === category ? colors.primary : colors.border }]} onPress={() => setNewPostCategory(newPostCategory === category ? null : category)}><Text variant="caption" color={newPostCategory === category ? 'accent' : 'primary'}>{category}</Text></TouchableOpacity>)}</View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      </LockedFeature>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }, createButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, categories: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 }, categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 }, postsContainer: { padding: 16, paddingTop: 0, paddingBottom: 32 }, emptyState: { alignItems: 'center', paddingTop: 48 }, emptyText: { marginTop: 16 }, modalContainer: { flex: 1 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#27272A' }, modalContent: { padding: 16 }, titleInput: { fontSize: 20, fontWeight: '600', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 16 }, contentInput: { fontSize: 16, minHeight: 150, marginBottom: 24 }, categoryLabel: { marginBottom: 12 }, categorySelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, categorySelectorChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5 } });
