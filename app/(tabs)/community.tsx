import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PostCard } from '@/components/PostCard';
import { LockedFeature } from '@/components/Paywall';
import { useAuth } from '@/hooks/useAuth';
import {
  getCommunityPosts,
  getPost,
  createPost,
  likePost,
  unlikePost,
  checkIfLiked,
  getComments,
  createComment,
} from '@/lib/api';
import type { CommunityPost, CommunityComment } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

const CATEGORIES = ['All', 'Growth Tips', 'Marketing', 'Technical', 'Funding'] as const;
type Category = (typeof CATEGORIES)[number];

export default function CommunityScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New post modal
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<string>('Growth Tips');
  const [posting, setPosting] = useState(false);

  // Post detail modal
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const category = selectedCategory === 'All' ? undefined : selectedCategory;
      const fetchedPosts = await getCommunityPosts(category);
      setPosts(fetchedPosts);

      // Check which posts are liked
      if (user) {
        const likedSet = new Set<string>();
        for (const post of fetchedPosts) {
          try {
            const isLiked = await checkIfLiked(post.id, user.id);
            if (isLiked) likedSet.add(post.id);
          } catch (e) {
            // Ignore individual check errors
          }
        }
        setLikedPosts(likedSet);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, user]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handleLike = async (postId: string) => {
    if (!user) return;

    const isCurrentlyLiked = likedPosts.has(postId);

    // Optimistic update
    const newLikedPosts = new Set(likedPosts);
    if (isCurrentlyLiked) {
      newLikedPosts.delete(postId);
    } else {
      newLikedPosts.add(postId);
    }
    setLikedPosts(newLikedPosts);

    // Update post count optimistically
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, likes_count: post.likes_count + (isCurrentlyLiked ? -1 : 1) }
          : post
      )
    );

    try {
      if (isCurrentlyLiked) {
        await unlikePost(postId, user.id);
      } else {
        await likePost(postId, user.id);
      }
    } catch (error) {
      // Revert on error
      console.error('Error toggling like:', error);
      setLikedPosts(likedPosts);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, likes_count: post.likes_count + (isCurrentlyLiked ? 1 : -1) }
            : post
        )
      );
    }
  };

  const handleCreatePost = async () => {
    if (!user || !newPostTitle.trim() || !newPostContent.trim()) {
      Alert.alert('Error', 'Please fill in both title and content');
      return;
    }

    setPosting(true);
    try {
      await createPost(user.id, newPostTitle.trim(), newPostContent.trim(), newPostCategory);
      setShowNewPost(false);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostCategory('Growth Tips');
      await loadPosts();
      Alert.alert('Success', 'Your post has been published!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleOpenPost = async (post: CommunityPost) => {
    setSelectedPost(post);
    setLoadingComments(true);
    try {
      const fetchedComments = await getComments(post.id);
      setComments(fetchedComments);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!user || !selectedPost || !newComment.trim()) return;

    setPostingComment(true);
    try {
      const comment = await createComment(selectedPost.id, user.id, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');

      // Update comment count in posts list
      setPosts((prev) =>
        prev.map((post) =>
          post.id === selectedPost.id
            ? { ...post, comments_count: post.comments_count + 1 }
            : post
        )
      );
      setSelectedPost((prev) =>
        prev ? { ...prev, comments_count: prev.comments_count + 1 } : null
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add comment');
    } finally {
      setPostingComment(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LockedFeature feature="community" featureTitle="Founder Community">
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text variant="title" weight="bold">Community</Text>
            <Text variant="caption" color="secondary">Connect with fellow founders</Text>
          </View>
          <TouchableOpacity
            style={[styles.newPostButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowNewPost(true)}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContainer}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    selectedCategory === category ? colors.primary : colors.card,
                  borderColor:
                    selectedCategory === category ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                variant="caption"
                weight={selectedCategory === category ? 'semibold' : 'regular'}
                style={{
                  color: selectedCategory === category ? '#FFFFFF' : colors.textSecondary,
                }}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Posts List */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {loading ? (
            <View style={styles.emptyState}>
              <Text variant="body" color="secondary">Loading posts...</Text>
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
              </View>
              <Text variant="subtitle" weight="semibold" style={styles.emptyTitle}>
                No posts yet
              </Text>
              <Text variant="body" color="secondary" align="center" style={styles.emptyText}>
                Be the first to share something with the community!
              </Text>
              <Button
                title="Create Post"
                onPress={() => setShowNewPost(true)}
                style={styles.emptyButton}
              />
            </View>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPress={() => handleOpenPost(post)}
                onLike={() => handleLike(post.id)}
                isLiked={likedPosts.has(post.id)}
              />
            ))
          )}
        </ScrollView>

        {/* New Post Modal */}
        <Modal
          visible={showNewPost}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowNewPost(false)}
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setShowNewPost(false)}>
                  <Text variant="body" color="secondary">Cancel</Text>
                </TouchableOpacity>
                <Text variant="label" weight="semibold">New Post</Text>
                <TouchableOpacity onPress={handleCreatePost} disabled={posting}>
                  <Text
                    variant="body"
                    style={{ color: posting ? colors.textSecondary : colors.primary }}
                  >
                    {posting ? 'Posting...' : 'Post'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                <Text variant="caption" color="secondary" style={styles.inputLabel}>
                  CATEGORY
                </Text>
                <View style={styles.categoryPicker}>
                  {CATEGORIES.filter((c) => c !== 'All').map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryOption,
                        {
                          backgroundColor:
                            newPostCategory === category ? colors.primary + '20' : colors.card,
                          borderColor:
                            newPostCategory === category ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setNewPostCategory(category)}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: newPostCategory === category ? colors.primary : colors.textSecondary,
                        }}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text variant="caption" color="secondary" style={styles.inputLabel}>
                  TITLE
                </Text>
                <TextInput
                  style={[
                    styles.titleInput,
                    { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
                  ]}
                  value={newPostTitle}
                  onChangeText={setNewPostTitle}
                  placeholder="What's on your mind?"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={100}
                />

                <Text variant="caption" color="secondary" style={styles.inputLabel}>
                  CONTENT
                </Text>
                <TextInput
                  style={[
                    styles.contentInput,
                    { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
                  ]}
                  value={newPostContent}
                  onChangeText={setNewPostContent}
                  placeholder="Share your thoughts, wins, or questions..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                />
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* Post Detail Modal */}
        <Modal
          visible={!!selectedPost}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedPost(null)}
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setSelectedPost(null)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text variant="label" weight="semibold">Post</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView style={styles.modalContent}>
                {selectedPost && (
                  <>
                    <View style={styles.postDetail}>
                      <View style={styles.postAuthor}>
                        <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                          <Text variant="label" weight="semibold" color="accent">
                            {selectedPost.profile?.full_name?.[0]?.toUpperCase() || 'A'}
                          </Text>
                        </View>
                        <View>
                          <Text variant="label" weight="semibold">
                            {selectedPost.profile?.full_name || 'Anonymous'}
                          </Text>
                          <Text variant="caption" color="secondary">
                            {formatDate(selectedPost.created_at)}
                          </Text>
                        </View>
                      </View>

                      {selectedPost.category && (
                        <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '15' }]}>
                          <Text variant="caption" color="accent">{selectedPost.category}</Text>
                        </View>
                      )}

                      <Text variant="subtitle" weight="bold" style={styles.postTitle}>
                        {selectedPost.title}
                      </Text>
                      <Text variant="body" style={styles.postContent}>
                        {selectedPost.content}
                      </Text>

                      <View style={styles.postStats}>
                        <View style={styles.statItem}>
                          <Ionicons
                            name={likedPosts.has(selectedPost.id) ? 'heart' : 'heart-outline'}
                            size={18}
                            color={likedPosts.has(selectedPost.id) ? colors.error : colors.textSecondary}
                          />
                          <Text variant="caption" color="secondary" style={{ marginLeft: 4 }}>
                            {selectedPost.likes_count}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
                          <Text variant="caption" color="secondary" style={{ marginLeft: 4 }}>
                            {selectedPost.comments_count}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.commentsDivider, { backgroundColor: colors.border }]} />

                    <Text variant="label" weight="semibold" style={styles.commentsHeader}>
                      Comments ({comments.length})
                    </Text>

                    {loadingComments ? (
                      <Text variant="caption" color="secondary" style={styles.loadingText}>
                        Loading comments...
                      </Text>
                    ) : comments.length === 0 ? (
                      <Text variant="caption" color="secondary" style={styles.noComments}>
                        No comments yet. Be the first to comment!
                      </Text>
                    ) : (
                      comments.map((comment) => (
                        <View key={comment.id} style={styles.commentItem}>
                          <View style={[styles.commentAvatar, { backgroundColor: colors.card }]}>
                            <Text variant="caption" weight="semibold" color="secondary">
                              {comment.profile?.full_name?.[0]?.toUpperCase() || 'A'}
                            </Text>
                          </View>
                          <View style={styles.commentContent}>
                            <View style={styles.commentHeader}>
                              <Text variant="caption" weight="semibold">
                                {comment.profile?.full_name || 'Anonymous'}
                              </Text>
                              <Text variant="caption" color="secondary">
                                {formatDate(comment.created_at)}
                              </Text>
                            </View>
                            <Text variant="body" style={styles.commentText}>
                              {comment.content}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </>
                )}
              </ScrollView>

              {/* Comment Input */}
              <View style={[styles.commentInputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                <TextInput
                  style={[styles.commentInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.textSecondary}
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[
                    styles.sendCommentButton,
                    { backgroundColor: newComment.trim() ? colors.primary : colors.card },
                  ]}
                  onPress={handleAddComment}
                  disabled={!newComment.trim() || postingComment}
                >
                  <Ionicons
                    name="send"
                    size={18}
                    color={newComment.trim() ? '#FFFFFF' : colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </LockedFeature>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  newPostButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptyText: {
    marginBottom: 24,
    maxWidth: 280,
  },
  emptyButton: {
    minWidth: 160,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    marginBottom: 8,
    marginTop: 16,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  titleInput: {
    fontSize: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  contentInput: {
    fontSize: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 200,
  },
  // Post detail styles
  postDetail: {
    marginBottom: 16,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  postTitle: {
    marginBottom: 12,
  },
  postContent: {
    lineHeight: 24,
    marginBottom: 16,
  },
  postStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentsDivider: {
    height: 1,
    marginVertical: 16,
  },
  commentsHeader: {
    marginBottom: 16,
  },
  loadingText: {
    paddingVertical: 20,
    textAlign: 'center',
  },
  noComments: {
    paddingVertical: 20,
    textAlign: 'center',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentText: {
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  sendCommentButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
