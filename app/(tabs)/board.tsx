import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ImageSourcePropType,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

interface User {
  name: string;
  points: number;
  image: ImageSourcePropType;
  position: number;
  isUser?: boolean;
}

interface NavItem {
  icon: ImageSourcePropType;
  label: string;
  active: boolean;
}

export default function App(): JSX.Element {
  const topThree: User[] = [
    { name: 'Faiz', points: 43, image: require('@/assets/images/faiz.png'), position: 1 },
    { name: 'You', points: 40, image: require('@/assets/images/firsa.png'), position: 2, isUser: true },
    { name: 'Nadya', points: 38, image: require('@/assets/images/nadya.png'), position: 3 },
  ];

  const others: User[] = [
    { name: 'Athaya', points: 36, image: require('@/assets/images/athaya.png'), position: 4 },
    { name: 'Sussy', points: 35, image: require('@/assets/images/sussy.png'), position: 5 },
    { name: 'Jane Doe', points: 34, image: require('@/assets/images/you.png'), position: 6 },
    { name: 'Saski', points: 33, image: require('@/assets/images/saski.png'), position: 7 },
  ];

  const navItems: NavItem[] = [
    { icon: require('@/assets/icons/chart-2.png'), label: 'BOARD', active: true },
    { icon: require('@/assets/icons/star.png'), label: 'GAMES', active: false },
    { icon: require('@/assets/icons/home.png'), label: 'HOME', active: false },
    { icon: require('@/assets/icons/bookmark.png'), label: 'COURSES', active: false },
    { icon: require('@/assets/icons/profile.png'), label: 'PROFILE', active: false },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hi, Firsa</Text>
          <Image source={require('@/assets/images/lenterra-logo.png')} style={styles.logoImage} />
        </View>

        <Text style={styles.sectionTitle}>Top Trending</Text>
        <View style={styles.trendingCard}>
          <Image source={require('@/assets/images/congklak-3.png')} style={styles.trendingImage} resizeMode="contain" />
        </View>

        <Text style={styles.sectionTitle}>Leaderboard</Text>

        <View style={styles.topThreeContainer}>
          {topThree.map((_, index) => {
            const displayIndex = index === 0 ? 1 : index === 1 ? 0 : 2;
            const userData = topThree[displayIndex];

            return (
              <View key={userData.position} style={styles.topThreeItem}>
                {userData.position === 1 && (
                  <Image source={require('@/assets/icons/crown.png')} style={styles.crownImage} />
                )}
                <View style={[styles.topThreeImageContainer, userData.position === 1 && styles.firstPlaceContainer]}>
                  <Image source={userData.image} style={styles.topThreeImage} />
                </View>
                <View style={[styles.positionBadge, userData.position === 1 && styles.firstPlaceBadge]}>
                  <Text style={styles.positionText}>{userData.position}</Text>
                </View>
                <Text style={styles.nameText}>{userData.name}</Text>
                <View style={styles.pointsContainer}>
                  <Image source={require('@/assets/icons/pts.png')} style={styles.ptsImage} />
                  <Text style={styles.pointsText}>{userData.points} pts</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.othersContainer}>
          {others.map((user) => (
            <View key={user.position} style={[styles.otherUserRow, user.isUser && styles.userRow]}>
              <View style={styles.otherUserLeft}>
                <View style={styles.otherPositionBadge}>
                  <Text style={styles.otherPositionText}>{user.position}</Text>
                </View>
                <Image source={user.image} style={styles.otherUserImage} />
                <Text style={styles.otherNameText}>{user.name}</Text>
              </View>
              <View style={styles.otherPointsContainer}>
                <Text style={styles.otherPointsText}>{user.points} pts</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 15,
  },
  trendingCard: {
    backgroundColor: '#99ccff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
    overflow: 'hidden',
  },
  trendingImage: {
    width: '100%',
    height: '100%',
  },
  topThreeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  topThreeItem: {
    alignItems: 'center',
    position: 'relative',
  },
  topThreeImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 5,
    position: 'relative',
  },
  firstPlaceContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderColor: '#FFD700',
    borderWidth: 2,
    zIndex: 1,
  },
  topThreeImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  crownImage: {
    width: 40,
    height: 40,
    zIndex: 2,
    marginBottom: -10,
  },
  positionBadge: {
    backgroundColor: '#f0f0f0',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  firstPlaceBadge: {
    backgroundColor: '#FFEB3B',
  },
  positionText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  nameText: {
    fontSize: 14,
    marginTop: 2,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ptsImage: {
    width: 16,
    height: 16,
    marginRight: 3,
  },
  pointsText: {
    fontSize: 12,
    color: '#666',
  },
  othersContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 15,
    overflow: 'hidden',
  },
  otherUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'white',
    marginBottom: 2,
    borderRadius: 10,
  },
  userRow: {
    backgroundColor: '#e3f7d8',
  },
  otherUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otherPositionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  otherPositionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  otherUserImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
  },
  otherNameText: {
    fontSize: 15,
    fontWeight: '500',
  },
  otherPointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otherPointsText: {
    fontSize: 14,
    fontWeight: '500',
  },
});