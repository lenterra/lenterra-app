import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const App: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f7" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi, Firsa</Text>
          <Image
            source={require('@/assets/images/lenterra-logo.png')}
            style={styles.logo}
          />
        </View>

        {/* Banner */}
        <LinearGradient
          colors={['#FFCC70', '#FF9770']}
          style={styles.bannerContainer}
        >
          <View style={styles.bannerContent}>
            <View>
              <Text style={styles.bannerTitle}>Exclusive</Text>
              <Text style={styles.bannerTitle}>Just For</Text>
              <Text style={styles.bannerTitle}>You!</Text>
            </View>
            <View style={styles.booksContainer}>
              <Image
                source={require('@/assets/images/book-2.png')}
                style={styles.bookImage}
              />
            </View>
          </View>
        </LinearGradient>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Image
              source={require('@/assets/icons/search.png')}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* Categories */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categoriesContainer}>
            <TouchableOpacity style={styles.categoryItem}>
              <View style={styles.categoryIconContainer}>
                <Image
                  source={require('@/assets/icons/advanced-stem.png')}
                  style={styles.categoryIcon}
                />
              </View>
              <Text style={styles.categoryText}>Advanced{'\n'}STEM</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.categoryItem}>
              <View style={styles.categoryIconContainer}>
                <Image
                  source={require('@/assets/icons/coding.png')}
                  style={styles.categoryIcon}
                />
              </View>
              <Text style={styles.categoryText}>Coding</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.categoryItem}>
              <View style={styles.categoryIconContainer}>
                <Image
                  source={require('@/assets/icons/intro-to-business.png')}
                  style={styles.categoryIcon}
                />
              </View>
              <Text style={styles.categoryText}>Intro To{'\n'}Business</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Courses */}
        <View style={styles.sectionContainer}>
          <View style={styles.coursesHeader}>
            <Text style={styles.sectionTitle}>Courses</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.coursesGrid}>
            <TouchableOpacity style={styles.courseCard}>
              <Image
                source={require('@/assets/images/physics.png')}
                style={styles.courseImage}
              />
              <View style={styles.courseInfo}>
                <Text style={styles.courseTitle}>Physics</Text>
                <View style={styles.courseTag}>
                  <Text style={styles.courseTagText}>Advanced STEM</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.courseCard}>
              <Image
                source={require('@/assets/images/python.png')}
                style={styles.courseImage}
              />
              <View style={styles.courseInfo}>
                <Text style={styles.courseTitle}>Python</Text>
                <View style={[styles.courseTag, styles.codingTag]}>
                  <Text style={[styles.courseTagText, styles.codingTagText]}>Coding</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.courseCard}>
              <Image
                source={require('@/assets/images/chemistry.png')}
                style={styles.courseImage}
              />
              <View style={styles.courseInfo}>
                <Text style={styles.courseTitle}>Chemistry</Text>
                <View style={styles.courseTag}>
                  <Text style={styles.courseTagText}>Advanced STEM</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.courseCard}>
              <Image
                source={require('@/assets/images/statistics.png')}
                style={styles.courseImage}
              />
              <View style={styles.courseInfo}>
                <Text style={styles.courseTitle}>Statistics</Text>
                <View style={[styles.courseTag, styles.businessTag]}>
                  <Text style={[styles.courseTagText, styles.businessTagText]}>Intro To Business</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  logo: {
    width: 40,
    height: 40,
  },
  bannerContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerContent: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    lineHeight: 34,
  },
  booksContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookImage: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  searchBar: {
    backgroundColor: '#fff',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: '#999',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  sectionContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#000',
  },
  categoriesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryItem: {
    alignItems: 'center',
    width: '30%',
  },
  categoryIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    width: 30,
    height: 30,
    tintColor: '#fff',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  coursesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  coursesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  courseCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  courseImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  courseInfo: {
    padding: 12,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  courseTag: {
    backgroundColor: '#E9F5E8',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  codingTag: {
    backgroundColor: '#E8F0F9',
  },
  businessTag: {
    backgroundColor: '#F0F9E8',
  },
  courseTagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4CAF50',
  },
  codingTagText: {
    color: '#0066FF',
  },
  businessTagText: {
    color: '#4CAF50',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNavItem: {
    borderTopWidth: 3,
    borderTopColor: '#0066FF',
    marginTop: -3,
  },
  navIcon: {
    width: 24,
    height: 24,
    marginBottom: 4,
    tintColor: '#888',
  },
  activeNavIcon: {
    tintColor: '#0066FF',
  },
  navText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#888',
  },
  activeNavText: {
    color: '#0066FF',
  },
});
