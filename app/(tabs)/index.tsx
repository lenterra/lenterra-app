import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const windowWidth = Dimensions.get('window').width;

const HomeScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi, Firsa</Text>
          <Image source={require('@/assets/images/lenterra-logo.png')} style={styles.logo} />
        </View>

        <Text style={styles.sectionTitle}>Exclusive Offers</Text>

        <LinearGradient
          colors={['#DB6B79', '#A17279']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.offerCard}
        >
          <View style={styles.bookContainer}>
            <Image
              source={require('@/assets/images/book-1.png')}
              style={styles.offerImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.offerContentWrapper}>
            <View style={styles.offerTopRow}>
              <View style={styles.offerBadge}>
                <Text style={styles.offerBadgeText}>Only For Today!</Text>
              </View>
              <View style={styles.discountContainer}>
                <Image
                  source={require('@/assets/icons/discount-shape.png')}
                  style={styles.discountShape}
                />
                <Text style={styles.discountText}>50% OFF</Text>
              </View>
            </View>

            <View style={styles.offerList}>
              <Text style={styles.offerListItem}>• Advanced STEM</Text>
              <Text style={styles.offerListItem}>• Coding (Python, Java, Etc)</Text>
              <Text style={styles.offerListItem}>• Intro To Business</Text>
            </View>

            <View style={styles.claimButtonContainer}>
              <TouchableOpacity style={styles.claimButton}>
                <Text style={styles.claimButtonText}>Claim</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.paginationDots}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <View style={styles.recommendedHeader}>
          <Text style={styles.sectionTitle}>Recommended For You</Text>
          <TouchableOpacity>
            <Text style={styles.moreText}>More</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gameCardContainer}>
          {[{
            title: 'Congklak',
            image: require('@/assets/images/congklak-1.png'),
            tags: [
              { text: 'Basic Computation', style: styles.pinkTagText, background: styles.pinkTag },
              { text: 'Algorithms', style: styles.blueTagText, background: styles.blueTag },
            ],
          }, {
            title: 'Benteng',
            image: require('@/assets/images/benteng-1.png'),
            tags: [
              { text: 'Basic Computation', style: styles.pinkTagText, background: styles.pinkTag },
              { text: 'Cyber Security', style: styles.yellowTagText, background: styles.yellowTag },
            ],
          }, {
            title: 'Engklek',
            image: require('@/assets/images/engklek-1.png'),
            tags: [
              { text: 'Algorithms', style: styles.blueTagText, background: styles.blueTag },
            ],
          }, {
            title: 'Gaple',
            image: require('@/assets/images/gaple-1.png'),
            tags: [
              { text: 'Basic Computation', style: styles.pinkTagText, background: styles.pinkTag },
              { text: 'Algorithms', style: styles.blueTagText, background: styles.blueTag },
            ],
          }].map((game, index) => (
            <View key={index} style={styles.gameCard}>
              <View style={styles.gameCardContent}>
                <Image source={game.image} style={styles.gameImage} />
                <View style={styles.gameInfo}>
                  <Text style={styles.gameTitle}>{game.title}</Text>
                  <View style={styles.tagContainer}>
                    {game.tags.map((tag, i) => (
                      <View key={i} style={[styles.tag, tag.background]}>
                        <Text style={tag.style}>{tag.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <TouchableOpacity style={styles.playButton}>
                  <Text style={styles.playButtonText}>Play!</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  } as ViewStyle,
  container: {
    padding: 16,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  } as ViewStyle,
  logo: {
    width: 50,
    height: 35,
  } as ImageStyle,
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
  } as TextStyle,
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  } as TextStyle,
  offerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    flexDirection: 'row',
    height: 180,
  } as ViewStyle,
  bookContainer: {
    width: '40%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 8,
  } as ViewStyle,
  offerImage: {
    width: '100%',
    height: 160,
    resizeMode: 'contain',
  } as ImageStyle,
  offerContentWrapper: {
    width: '60%',
    padding: 16,
    justifyContent: 'space-between',
  } as ViewStyle,
  offerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  } as ViewStyle,
  offerBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  } as ViewStyle,
  offerBadgeText: {
    fontWeight: 'bold',
    color: '#000',
    fontSize: 12,
  } as TextStyle,
  discountContainer: {
    alignItems: 'center',
  } as ViewStyle,
  discountShape: {
    width: 24,
    height: 24,
    marginBottom: 4,
  } as ImageStyle,
  discountText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 10,
  } as TextStyle,
  offerList: {
    marginTop: 8,
  } as ViewStyle,
  offerListItem: {
    color: '#FFF',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  } as TextStyle,
  claimButtonContainer: {
    alignItems: 'flex-end',
    marginTop: 'auto',
  } as ViewStyle,
  claimButton: {
    backgroundColor: '#C6444F',
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 24,
  } as ViewStyle,
  claimButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  } as TextStyle,
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  } as ViewStyle,
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  } as ViewStyle,
  activeDot: {
    backgroundColor: '#FFC107',
  } as ViewStyle,
  recommendedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  } as ViewStyle,
  moreText: {
    color: '#888',
    fontSize: 16,
  } as TextStyle,
  gameCardContainer: {
    gap: 12,
  } as ViewStyle,
  gameCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,
  gameCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  gameImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  } as ImageStyle,
  gameInfo: {
    marginLeft: 12,
    flex: 1,
  } as ViewStyle,
  gameTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  } as TextStyle,
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  } as ViewStyle,
  tag: {
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  } as ViewStyle,
  pinkTag: {
    backgroundColor: '#FFCECE',
  } as ViewStyle,
  pinkTagText: {
    fontSize: 10,
    color: '#FF5757',
  } as TextStyle,
  blueTag: {
    backgroundColor: '#D1E5FF',
  } as ViewStyle,
  blueTagText: {
    fontSize: 10,
    color: '#0066FF',
  } as TextStyle,
  yellowTag: {
    backgroundColor: '#FFF3D1',
  } as ViewStyle,
  yellowTagText: {
    fontSize: 10,
    color: '#FFB800',
  } as TextStyle,
  playButton: {
    backgroundColor: '#ED5B3A',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  } as ViewStyle,
  playButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  } as TextStyle,
});

export default HomeScreen;