import React, { useRef, useEffect, useState } from 'react';
import { ConnectButton, lightTheme, useActiveAccount } from "thirdweb/react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { chain, client } from "@/constants/thirdweb";
import { createAuth } from "thirdweb/auth";
import { ethereum } from "thirdweb/chains";
import { createWallet } from "thirdweb/wallets";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ImageSourcePropType,
  useColorScheme,
  Modal,
  Pressable
} from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import nakamaClient, { setSession, getSession, clearSession } from "@/lib/nakama-client";

const screenWidth = Dimensions.get('window').width;

const images = [
  require('@/assets/images/congklak-2.png'),
  require('@/assets/images/python.png'),
  require('@/assets/images/statistics.png'),
];

type TabType = 'record' | 'statistics' | 'friends' | 'certificates';
type FriendType = 'friend' | 'request' | 'pending';

type GameCardProps = {
  title: string;
  image: ImageSourcePropType;
  tags: string[];
  progress: number;
};

type FriendCardProps = {
  name: string;
  image: ImageSourcePropType;
  type: FriendType;
}

type NavItemProps = {
  icon: ImageSourcePropType;
  label: string;
  active: boolean;
};


type CertificateImage = {
  id: number;
  image: ImageSourcePropType;
};

const thirdwebAuth = createAuth({
  domain: "localhost:3000",
  client,
});

let isLoggedIn = false;

export default function App() {
  const account = useActiveAccount();
  const theme = useColorScheme();
  useEffect(() => {
    console.log("Inside useEffect");
    const syncSession = async () => {
      console.log("Inside syncSession");
      if (account) {
        console.log("account:", account);
        console.log("getSession():", getSession());
        if (!getSession()) {
          const session = await nakamaClient.authenticateCustom(account.address);
          console.log(session);
          setSession(session);
        }
      } else {
        if (getSession()) {
          clearSession();
        }
      }
    };
  
    syncSession();
  }, [account?.address]);


  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [name, setName] = useState<string>("Firsa");

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % images.length;
      scrollRef.current?.scrollTo({ x: nextIndex * screenWidth, animated: true });
      setCurrentIndex(nextIndex);
    }, 1500);

    return () => clearInterval(interval);
  }, [currentIndex]);

  const [activeTab, setActiveTab] = useState<TabType>('record');
  const [activeFriendsTab, setActiveFriendsTab] = useState<FriendType>('friend');
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageSourcePropType | null>(null);
  
  const handleImagePress = (image: ImageSourcePropType) => {
    setSelectedImage(image);
    setLightboxVisible(true);
  };

  const pieChartData = [
    {
      name: "Basic Computation",
      population: 40,
      color: "#e74c3c",
      legendFontColor: "#7F7F7F",
      legendFontSize: 12
    },
    {
      name: "Algorithms",
      population: 40,
      color: "#3498db",
      legendFontColor: "#7F7F7F",
      legendFontSize: 12
    },
    {
      name: "Cyber Security",
      population: 20,
      color: "#f1c40f",
      legendFontColor: "#7F7F7F",
      legendFontSize: 12
    }
  ];

  // Friend data
  const friendsList = [
    { id: 1, name: 'Athaya', image: require('@/assets/images/ariana.png') },
    { id: 2, name: 'Faiz', image: require('@/assets/images/faiz.png') },
    { id: 3, name: 'Firsa', image: require('@/assets/images/ariana.png') },
    { id: 4, name: 'Saski', image: require('@/assets/images/ariana.png') },
    { id: 5, name: 'Sussy', image: require('@/assets/images/ariana.png') },
  ];

  const requestsList = [
    { id: 6, name: 'Justin Bieber', image: require('@/assets/images/ariana.png') },
    { id: 7, name: 'Rihanna', image: require('@/assets/images/ariana.png') },
    { id: 8, name: 'Selena Gomez', image: require('@/assets/images/ariana.png') },
  ];

  const pendingList = [
    { id: 9, name: 'Raisa', image: require('@/assets/images/ariana.png') },
  ];
  
  const certificateImages: CertificateImage[] = [
    { id: 1, image: require('@/assets/images/certificate.png') },
  ];

  return (
    !!account ? (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Image source={require('@/assets/images/lenterra-logo.png')} style={styles.sunIcon} />
          
          <View style={styles.profileContainer}>
            <Image 
              source={require('@/assets/images/firsa.png')} 
              style={styles.profileImage} 
            />
            <Text style={styles.profileName}>Firsa</Text>
          </View>

          <View style={styles.connectButton}>
            <ConnectButton
                  client={client}
                  chain={ethereum}
                  theme={lightTheme({
                    colors: {
                      primaryButtonBg: "#1e8449",
                      modalBg: "#1e8449",
                      borderColor: "#196f3d",
                      accentButtonBg: "#196f3d",
                      primaryText: "#ffffff",
                      secondaryIconColor: "#a7b8b9",
                      secondaryText: "#a7b8b9",
                      secondaryButtonBg: "#196f3d",
                    },
                  })}
                  wallets={[
                    createWallet("io.metamask"),
                    createWallet("com.coinbase.wallet"),
                    createWallet("me.rainbow"),
                    createWallet("com.trustwallet.app"),
                    createWallet("io.zerion.wallet"),
                    createWallet("xyz.argent"),
                    createWallet("com.okex.wallet"),
                    createWallet("com.zengo"),
                  ]}
                  connectButton={{
                    label: "Sign in to Lenterra",
                  }}
                  connectModal={{
                    title: "Web3 Login",
                  }}
            />
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Image 
                source={require('@/assets/icons/star-putih.png')} 
                style={styles.statIcon} 
              />
              <Text style={styles.statTitle}>POINTS</Text>
              <Text style={styles.statValue}>40</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.statItem}>
              <Image 
                source={require('@/assets/icons/rank.png')} 
                style={styles.statIcon} 
              />
              <Text style={styles.statTitle}>RANK</Text>
              <Text style={styles.statValue}>#3</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.statItem}>
              <Image 
                source={require('@/assets/icons/friends.png')} 
                style={styles.statIcon} 
              />
              <Text style={styles.statTitle}>FRIENDS</Text>
              <Text style={styles.statValue}>20</Text>
            </View>
          </View>
          
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={styles.tab}
              onPress={() => setActiveTab('record')}
            >
              <Text style={activeTab === 'record' ? styles.tabActiveText : styles.tabText}>
                Record
              </Text>
              {activeTab === 'record' && <View style={styles.tabActiveDot} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.tab}
              onPress={() => setActiveTab('statistics')}
            >
              <Text style={activeTab === 'statistics' ? styles.tabActiveText : styles.tabText}>
                Statistics
              </Text>
              {activeTab === 'statistics' && <View style={styles.tabActiveDot} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.tab}
              onPress={() => setActiveTab('friends')}
            >
              <Text style={activeTab === 'friends' ? styles.tabActiveText : styles.tabText}>
                Friends
              </Text>
              {activeTab === 'friends' && <View style={styles.tabActiveDot} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.tab}
              onPress={() => setActiveTab('certificates')}
            >
              <Text style={activeTab === 'certificates' ? styles.tabActiveText : styles.tabText}>
                Certificates
              </Text>
              {activeTab === 'certificates' && <View style={styles.tabActiveDot} />}
            </TouchableOpacity>
          </View>
        </View>
        
        {activeTab === 'record' && (
          <View style={styles.cardList}>
            <GameCard 
              title="Congklak" 
              image={require('@/assets/images/congklak-1.png')}
              tags={['Basic Computation', 'Algorithms']}
              progress={70}
            />
            
            <GameCard 
              title="Benteng" 
              image={require('@/assets/images/benteng-1.png')}
              tags={['Basic Computation', 'Cyber Security']}
              progress={50}
            />
            
            <GameCard 
              title="Gaple" 
              image={require('@/assets/images/gaple-1.png')}
              tags={['Basic Computation', 'Algorithms']}
              progress={50}
            />
          </View>
        )}
        
        {activeTab === 'statistics' && (
          <View style={styles.statisticsContainer}>
            <View style={styles.weeklyLogCard}>
              <Text style={styles.cardHeader}>Weekly Log</Text>
              <LineChart
                data={{
                  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                  datasets: [
                    {
                      data: [10, 30, 20, 30, 10, 28, 18],
                      color: (opacity = 1) => `rgba(46, 141, 225, ${opacity})`,
                      strokeWidth: 2
                    }
                  ]
                }}
                width={screenWidth - 40}
                height={160}
                chartConfig={{
                  backgroundColor: "#f3f8fe",
                  backgroundGradientFrom: "#f3f8fe",
                  backgroundGradientTo: "#f3f8fe",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(46, 141, 225, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(120, 120, 120, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: "5",
                    strokeWidth: "0",
                    stroke: "#2E8DE1"
                  }
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16
                }}
                withInnerLines={false}
                withOuterLines={false}
              />
            </View>
            
            <View style={styles.statsCardsRow}>
              <View style={styles.overallActivityCard}>
                <Text style={styles.overallActivityTitle}>Overall Activity</Text>
                <PieChart
                  data={pieChartData}
                  width={screenWidth / 2 - 30}
                  height={120}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  }}
                  accessor={"population"}
                  backgroundColor={"transparent"}
                  paddingLeft={"0"}
                  center={[0, 0]}
                  absolute
                  hasLegend={false}
                />
                <View style={styles.pieChartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, {backgroundColor: '#e74c3c'}]} />
                    <Text style={styles.legendText}>40% Basic Computation</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, {backgroundColor: '#3498db'}]} />
                    <Text style={styles.legendText}>40% Algorithms</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, {backgroundColor: '#f1c40f'}]} />
                    <Text style={styles.legendText}>20% Cyber Security</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.performanceCard}>
                <Text style={styles.performanceTitle}>Performance Report</Text>
                <View style={styles.circularProgressWrapper}>
                  <AnimatedCircularProgress
                    size={100}
                    width={10}
                    fill={60}
                    tintColor="#ffffff"
                    backgroundColor="rgba(255, 255, 255, 0.3)"
                    rotation={0}
                  >
                    {
                      (fill) => (
                        <Text style={styles.progressText}>
                          {`${Math.round(fill)}%`}
                        </Text>
                      )
                    }
                  </AnimatedCircularProgress>
                </View>
                <Text style={styles.performanceLabel}>Increase From Last Week</Text>
              </View>
            </View>
          </View>
        )}
        
        {activeTab === 'friends' && (
          <View style={styles.friendsContainer}>
            <View style={styles.friendsTabContainer}>
              <TouchableOpacity 
                style={[
                  styles.friendsTab,
                  activeFriendsTab === 'friend' && styles.friendsTabActive
                ]}
                onPress={() => setActiveFriendsTab('friend')}
              >
                <Text style={activeFriendsTab === 'friend' ? styles.friendsTabTextActive : styles.friendsTabText}>
                  Friends
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.friendsTab,
                  activeFriendsTab === 'request' && styles.friendsTabActive
                ]}
                onPress={() => setActiveFriendsTab('request')}
              >
                <Text style={activeFriendsTab === 'request' ? styles.friendsTabTextActive : styles.friendsTabText}>
                  Requests
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.friendsTab,
                  activeFriendsTab === 'pending' && styles.friendsTabActive
                ]}
                onPress={() => setActiveFriendsTab('pending')}
              >
                <Text style={activeFriendsTab === 'pending' ? styles.friendsTabTextActive : styles.friendsTabText}>
                  Pending
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.friendsContentContainer}>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search friends..."
                />
                <TouchableOpacity style={styles.searchButton}>
                  <Text style={styles.searchButtonText}>Search</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.idContainer}>
                <Text style={styles.idLabel}>Your ID:</Text>
                <Text 
                numberOfLines={1}
                ellipsizeMode="middle" // options: 'head', 'middle', 'tail', 'clip'
                style={{ width: 200, fontWeight: 'bold'}}>{account.address}</Text>
              </View>
              
              <View style={styles.friendsList}>
                {activeFriendsTab === 'friend' && friendsList.map(friend => (
                  <FriendCard 
                    key={friend.id}
                    name={friend.name}
                    image={friend.image}
                    type="friend"
                  />
                ))}
                
                {activeFriendsTab === 'request' && requestsList.map(friend => (
                  <FriendCard 
                    key={friend.id}
                    name={friend.name}
                    image={friend.image}
                    type="request"
                  />
                ))}
                
                {activeFriendsTab === 'pending' && pendingList.map(friend => (
                  <FriendCard 
                    key={friend.id}
                    name={friend.name}
                    image={friend.image}
                    type="pending"
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {activeTab === 'certificates' && (
          <View style={styles.certificateContainer}>
            {certificateImages.map(cert => (
              <TouchableOpacity key={cert.id} onPress={() => handleImagePress(cert.image)}>
                <Image source={cert.image} style={styles.certificateImage} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Modal visible={lightboxVisible} transparent animationType="fade">
          <Pressable style={styles.lightboxOverlay} onPress={() => setLightboxVisible(false)}>
            <Image source={selectedImage!} style={styles.fullWidthLightboxImage} resizeMode="contain" />
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  ) : (
    <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Image 
                source={require('@/assets/images/lenterra-logo.png')} 
                style={styles.logo} 
              />
            </View>
            <View style={styles.containerlogin}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              scrollEnabled={false}
            >
              {images.map((image, index) => (
                <Image
                  key={index}
                  source={image}
                  style={styles.image}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
        
              <Text style={styles.title}>Selamat Datang di Lenterra</Text>
        
              <TextInput
                style={styles.input}
                placeholder="Masukkan nama Anda"
                value={name}
                onChangeText={setName}
              />

              <ConnectButton
                client={client}
                chain={ethereum}
                theme={lightTheme({
                  colors: {
                    primaryButtonBg: "#1e8449",
                    modalBg: "#1e8449",
                    borderColor: "#196f3d",
                    accentButtonBg: "#196f3d",
                    primaryText: "#ffffff",
                    secondaryIconColor: "#a7b8b9",
                    secondaryText: "#a7b8b9",
                    secondaryButtonBg: "#196f3d",
                  },
                })}
                wallets={[
                  createWallet("io.metamask"),
                  createWallet("com.coinbase.wallet"),
                  createWallet("me.rainbow"),
                  createWallet("com.trustwallet.app"),
                  createWallet("io.zerion.wallet"),
                  createWallet("xyz.argent"),
                  createWallet("com.okex.wallet"),
                  createWallet("com.zengo"),
                ]}
                connectButton={{
                  label: "Sign in to Lenterra",
                }}
                connectModal={{
                  title: "Web3 Login",
                }}
              />
            </View>
          </ScrollView>
      </SafeAreaView>
    )
  );
}

function GameCard({ title, image, tags, progress }: GameCardProps) {
  const progressColor = '#2E8DE1';
  const progressBgColor = '#E6E6E6';
  
  return (
    <View style={styles.card}>
      <Image source={image} style={styles.cardImage} />
      
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        
        <View style={styles.tagContainer}>
          {tags.map((tag, index) => (
            <View 
              key={index} 
              style={[
                styles.tag,
                { backgroundColor: tag.includes('Basic') ? '#FFD0CC' : 
                                  tag.includes('Cyber') ? '#FFF5CC' : 
                                  '#D0E6FF' }
              ]}
            >
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, {backgroundColor: progressBgColor}]}>
            <View 
              style={[
                styles.progressFill, 
                {
                  backgroundColor: progressColor,
                  width: `${progress}%`
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      </View>
    </View>
  );
}

function FriendCard({ name, image, type }: FriendCardProps) {
  return (
    <View style={styles.friendCard}>
      <Image source={image} style={styles.friendAvatar} />
      <Text style={styles.friendName}>{name}</Text>
      
      {type === 'request' && (
        <View style={styles.requestButtons}>
          <TouchableOpacity style={styles.acceptButton}>
            <Text style={styles.acceptButtonText}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectButton}>
            <Text style={styles.rejectButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {type === 'pending' && (
        <TouchableOpacity style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function NavItem({ icon, label, active }: NavItemProps) {
  return (
    <TouchableOpacity style={styles.navItem}>
      <Image 
        source={icon} 
        style={[
          styles.navIcon,
          active && { tintColor: '#2E8DE1' }
        ]} 
      />
      <Text 
        style={[
          styles.navLabel,
          active && { color: '#2E8DE1' }
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingBottom: 80,
  },
  header: {
    backgroundColor: '#2E8DE1',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
    paddingBottom: 10,
    position: 'relative',
  },
  sunIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
  },
  profileContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'white',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
    marginTop: 10,
  },
  statsContainer: {
    backgroundColor: '#2E8DE1',
    flexDirection: 'row',
    borderRadius: 10,
    marginTop: 20,
    marginHorizontal: 10,
    padding: 15,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 24,
    height: 24,
    marginBottom: 5,
  },
  statTitle: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  divider: {
    width: 1,
    backgroundColor: 'white',
    opacity: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: 10,
  },
  tab: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    position: 'relative',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  tabActiveText: {
    color: 'black',
    fontWeight: 'bold',
  },
  tabActiveDot: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E8DE1',
  },
  
  // Friends specific styles
  friendsContainer: {
    flex: 1,
    backgroundColor: '#f3f8fe',
  },
  friendsTabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 10,
    overflow: 'hidden',
  },
  friendsTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  friendsTabActive: {
    backgroundColor: '#2E8DE1',
  },
  friendsTabText: {
    color: 'gray',
    fontWeight: '500',
    fontSize: 14,
  },
  friendsTabTextActive: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  friendsContentContainer: {
    backgroundColor: '#f0f8ff',
    margin: 10,
    borderRadius: 15,
    padding: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: '#2E8DE1',
    borderRadius: 20,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  idLabel: {
    color: '#2E8DE1',
    fontWeight: 'bold',
    marginRight: 8,
  },
  friendsList: {
    marginTop: 5,
  },
  friendCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF9CC',
    borderRadius: 15,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
  },
  friendName: {
    flex: 1,
    fontWeight: '500',
    fontSize: 16,
  },
  requestButtons: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  rejectButton: {
    backgroundColor: '#F44336',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#F44336',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  
  // Existing styles continued
  cardList: {
    padding: 15,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    marginBottom: 15,
    flexDirection: 'row',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  cardContent: {
    flex: 1,
    marginLeft: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statisticsContainer: {
    padding: 20,
  },
  weeklyLogCard: {
    backgroundColor: '#f3f8fe',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E8DE1',
    marginBottom: 10,
  },
  statsCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overallActivityCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  overallActivityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  pieChartLegend: {
    marginTop: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#333',
  },
  performanceCard: {
    flex: 1,
    backgroundColor: '#2E8DE1',
    borderRadius: 15,
    padding: 15,
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  circularProgressWrapper: {
    marginVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  performanceLabel: {
    fontSize: 12,
    color: 'white',
    marginTop: 5,
    textAlign: 'center',
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIcon: {
    width: 24,
    height: 24,
    marginBottom: 4,
    opacity: 0.8,
  },
  navLabel: {
    fontSize: 10,
    color: '#666',
  },

  titleContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
  connectButton: {
    paddingTop: 16 
  },
  containerlogin: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  carousel: {
    height: 250,
    width: '100%',
    marginBottom: 24,
  },
  image: {
    width: screenWidth - 32,
    height: 250,
    borderRadius: 16,
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  logo: {
    width: 40,
    height: 40,
  },
  certificateContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 10,
  },
  certificateImage: {
    width: 160,
    height: 90,
    margin: 10,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidthLightboxImage: {
    width: screenWidth - 40,
    height: 'auto',
    aspectRatio: 1.5,
    borderRadius: 10,
  },
});