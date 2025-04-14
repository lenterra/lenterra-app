import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ImageSourcePropType,
  Dimensions,
  Animated,
  FlatList,
  ListRenderItemInfo,
  ViewToken,
  TouchableWithoutFeedback,
  ImageBackground,
  ScaledSize
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useNavigation } from '@react-navigation/native';
const { width, height } = Dimensions.get('window');

type ViewableItems = {
  viewableItems: Array<ViewToken>;
};

const gameImages: number[] = [
  require('@/assets/images/congklak-5.png'),
  require('@/assets/images/congklak-4.png'),
];

export default function App(): JSX.Element {
  const [details, setDetails] = useState<boolean>(false);

  const [expanded, setExpanded] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const animatedHeight = useRef(new Animated.Value(height * 0.75)).current;
  const animatedPosition = useRef(new Animated.Value(height * 0.25)).current;
  const animatedBorderRadius = useRef(new Animated.Value(28)).current;
  const flatListRef = useRef<FlatList<number>>(null);

  const handleExpand = () => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: expanded ? height * 0.75 : height,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(animatedPosition, {
        toValue: expanded ? height * 0.25 : 20,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(animatedBorderRadius, {
        toValue: expanded ? 28 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
    setExpanded(!expanded);
  };

  const handleNextImage = () => {
    if (currentImageIndex < gameImages.length - 1) {
      const newIndex = currentImageIndex + 1;
      setCurrentImageIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      const newIndex = currentImageIndex - 1;
      setCurrentImageIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

  const onViewableItemsChanged = useRef((info: ViewableItems) => {
    if (info.viewableItems.length > 0 && info.viewableItems[0].index != null) {
      setCurrentImageIndex(info.viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderCarouselItem = ({ item }: ListRenderItemInfo<number>) => (
    <View style={styles.carouselItem}>
      <Image source={item} style={styles.carouselImage} resizeMode="cover" />
    </View>
  );

  const [playing, setPlaying] = useState<boolean>(false);

  const navigation = useNavigation();

  useEffect(() => {
    const updateOrientation = ({ window }: { window: ScaledSize }) => {
      const isLandscape = window.width > window.height;
      navigation.setOptions({
        tabBarStyle: isLandscape ? { display: 'none' } : undefined,
      });
    };

    updateOrientation({ window: Dimensions.get('window') });

    const subscription = Dimensions.addEventListener('change', updateOrientation);

    return () => subscription.remove();
  }, [navigation]);

  const playCongklak = async () => {
    setPlaying(true);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  };

  const exitCongklak = async () => {
    setPlaying(false);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  };

  const [board, setBoard] = useState([
      0, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, // H1, A1-A5, H2, B1-B5
    ]);
    const [currentPlayer, setCurrentPlayer] = useState(1); // Player 1 (bottom) starts
    const [gameStatus, setGameStatus] = useState('playing');
    const [animating, setAnimating] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  
    const isSelectable = (index: number): boolean => {
      if (animating || gameStatus !== 'playing' || board[index] === 0) return false;
      if (currentPlayer === 1 && index >= 7 && index <= 11) return true; // Player 1: B1-B5
      if (currentPlayer === 2 && index >= 1 && index <= 5) return true; // Player 2: A1-A5
      return false;
    };
  
    const handlePitSelect = (index: number) => {
      if (!isSelectable(index)) return;
  
      setAnimating(true);
      let seeds = board[index];
      let newBoard = [...board];
      newBoard[index] = 0;
      let currentIndex = index;
  
      const distributeSeeds = () => {
        if (seeds > 0) {
          currentIndex = (currentIndex + 1) % 12;
          if ((currentPlayer === 1 && currentIndex === 0) || (currentPlayer === 2 && currentIndex === 6)) {
            // Skip opponent's home pit
            currentIndex = (currentIndex + 1) % 12;
          }
          newBoard[currentIndex]++;
          seeds--;
          setBoard([...newBoard]);
  
          setTimeout(() => {
            if (seeds > 0) {
              distributeSeeds();
            } else {
              finishTurn(currentIndex, newBoard);
            }
          }, 200); // Delay between distributing seeds
        } else {
          finishTurn(currentIndex, newBoard);
        }
      };
  
      distributeSeeds();
    };
  
    const finishTurn = (lastIndex: number, newBoard: number[]) => {
      let nextPlayer = currentPlayer;
      
      // If the last seed ends in your own store, you get another turn
      if ((currentPlayer === 1 && lastIndex === 6) || (currentPlayer === 2 && lastIndex === 0)) {
        nextPlayer = currentPlayer;
      } else {
        nextPlayer = currentPlayer === 1 ? 2 : 1;
      }
      
      setCurrentPlayer(nextPlayer);
      setAnimating(false);
      
      // Check if mission is complete - 2 seeds added to H2 in 1 turn
      if (currentPlayer === 1 && newBoard[6] >= 2) {
        setShowSuccessPopup(true);
      }
    };
  
    const handleRetryRequest = () => {
      setGameStatus('retry');
    };
  
    const handleRetry = () => {
      setBoard([0, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7]);
      setCurrentPlayer(1);
      setGameStatus('playing');
      setShowSuccessPopup(false);
    };
  
    const handleCancelRetry = () => {
      setGameStatus('playing');
    };
  
    const handleExitRequest = () => {
      setGameStatus('exit');
      exitCongklak();
    };
  
    const handleExit = () => {
      // Implement exit functionality here
      // For demo purposes, we'll just reset the game
      handleRetry();
    };
  
    const handleCancelExit = () => {
      setGameStatus('playing');
    };
  
    const handleShowMission = () => {
      setGameStatus('mission');
    };
  
    const handleHideMission = () => {
      setGameStatus('playing');
    };
  
    const toggleControls = () => {
      setControlsVisible(!controlsVisible);
    };
  
    const handleNextMission = () => {
      // Logic for next mission
      handleRetry();
    };
  
    const handleOtherGames = () => {
      // Logic for other games
      handleRetry();
    };
  
    // Improved render seeds function that arranges seeds in a circular pattern
    const renderSeeds = (count: number, isHomePit: boolean = false) => {
      if (count === 0) return null;
      
      // Different arrangement for home pits vs regular pits
      if (isHomePit) {
        // For home pits, arrange in stacked circles
        const seedsPerRow = [6, 9, 12, 15]; // Seeds in each circular arrangement
        const maxRows = 4;
        
        const seedElements = [];
        let seedsLeft = count;
        let currentRow = 0;
        
        while (seedsLeft > 0 && currentRow < maxRows) {
          const seedsInThisRow = Math.min(seedsLeft, seedsPerRow[currentRow]);
          const angleIncrement = (2 * Math.PI) / seedsInThisRow;
          const radius = 15 + (currentRow * 10); // Increasing radius for each row
          
          for (let i = 0; i < seedsInThisRow; i++) {
            const angle = i * angleIncrement;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            seedElements.push(
              <Image 
                key={`seed-home-${currentRow}-${i}`} 
                style={[
                  styles.congklakseedImage,
                  {
                    position: 'absolute',
                    transform: [
                      { translateX: x },
                      { translateY: y }
                    ]
                  }
                ]} 
                source={require('@/assets/images/biji.png')} 
              />
            );
          }
          
          seedsLeft -= seedsInThisRow;
          currentRow++;
        }
        
        // If we still have seeds left, just stack them in the center
        if (seedsLeft > 0) {
          seedElements.push(
            <View key="seed-home-extra" style={styles.congklakextraSeedsContainer}>
              <Text style={styles.congklakextraSeedsText}>+{seedsLeft}</Text>
            </View>
          );
        }
        
        return seedElements;
      } else {
        // For regular pits, arrange in a single circle
        const seedElements = [];
        
        // Determine how many seeds to show as individual images
        const maxVisibleSeeds = 14;
        const visibleCount = Math.min(count, maxVisibleSeeds);
        
        if (visibleCount <= 7) {
          // For 7 or fewer seeds, arrange in a single circle
          const angleIncrement = (2 * Math.PI) / visibleCount;
          const radius = 15; // Radius of the circle
          
          for (let i = 0; i < visibleCount; i++) {
            const angle = i * angleIncrement;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            seedElements.push(
              <Image 
                key={`seed-${i}`} 
                style={[
                  styles.congklakseedImage,
                  {
                    position: 'absolute',
                    transform: [
                      { translateX: x },
                      { translateY: y }
                    ]
                  }
                ]} 
                source={require('@/assets/images/biji.png')} 
              />
            );
          }
        } else {
          // For more than 7 seeds, arrange in double circles
          // Inner circle with 7 seeds
          const innerRadius = 10;
          const innerAngleIncrement = (2 * Math.PI) / 7;
          
          for (let i = 0; i < 7; i++) {
            const angle = i * innerAngleIncrement;
            const x = Math.cos(angle) * innerRadius;
            const y = Math.sin(angle) * innerRadius;
            
            seedElements.push(
              <Image 
                key={`seed-inner-${i}`} 
                style={[
                  styles.congklakseedImage,
                  {
                    position: 'absolute',
                    transform: [
                      { translateX: x },
                      { translateY: y }
                    ]
                  }
                ]} 
                source={require('@/assets/images/biji.png')} 
              />
            );
          }
          
          // Outer circle with remaining visible seeds
          const outerCount = visibleCount - 7;
          const outerRadius = 20;
          const outerAngleIncrement = (2 * Math.PI) / outerCount;
          
          for (let i = 0; i < outerCount; i++) {
            const angle = i * outerAngleIncrement;
            const x = Math.cos(angle) * outerRadius;
            const y = Math.sin(angle) * outerRadius;
            
            seedElements.push(
              <Image 
                key={`seed-outer-${i}`} 
                style={[
                  styles.congklakseedImage,
                  {
                    position: 'absolute',
                    transform: [
                      { translateX: x },
                      { translateY: y }
                    ]
                  }
                ]} 
                source={require('@/assets/images/biji.png')} 
              />
            );
          }
        }
        
        // If we have more seeds than can be shown visually, add a count indicator
        if (count > maxVisibleSeeds) {
          seedElements.push(
            <View key="seed-extra" style={styles.congklakseedCountContainer}>
              <Text style={styles.congklakseedCountText}>{count}</Text>
            </View>
          );
        }
        
        return seedElements;
      }
    };
  
    // Special render for home pits (H1 and H2)
    const renderHomePit = (index: number, position: string) => {
      const count = board[index];
      
      return (
        <View style={[styles.congklakhomePit, position === 'left' ? styles.congklakleftHomePit : styles.congklakrightHomePit]}>
          <Text style={styles.congklakhomePitLabel}>{position === 'left' ? 'H1' : 'H2'}</Text>
          <View style={styles.congklakhomePitSeedsContainer}>
            {renderSeeds(count, true)}
          </View>
        </View>
      );
    };
  
    const renderCard = () => {
      if (gameStatus === 'mission') {
        return (
          <View style={styles.congklakcard}>
            <Text style={styles.congklakcardTitle}>MISI</Text>
            <Text style={styles.congklakcardText}>Rancang langkah yang bisa mengisi 2 biji ke lubang H2 dalam 1 giliran</Text>
            <TouchableOpacity style={styles.congklakhiddenButton} onPress={handleHideMission} />
          </View>
        );
      } else if (gameStatus === 'retry') {
        return (
          <View style={styles.congklakcard}>
            <Text style={styles.congklakcardTitle}>ULANGI?</Text>
            <View style={styles.congklakcardButtons}>
              <TouchableOpacity style={styles.congklakcardButton} onPress={handleRetry}>
                <Text style={styles.congklakcardButtonText}>YA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.congklakcardButton} onPress={handleCancelRetry}>
                <Text style={styles.congklakcardButtonText}>TIDAK</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      } else if (gameStatus === 'exit') {
        return (
          <View style={styles.congklakcard}>
            <Text style={styles.congklakcardTitle}>KELUAR?</Text>
            <View style={styles.congklakcardButtons}>
              <TouchableOpacity style={styles.congklakcardButton} onPress={handleExit}>
                <Text style={styles.congklakcardButtonText}>YA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.congklakcardButton} onPress={handleCancelExit}>
                <Text style={styles.congklakcardButtonText}>TIDAK</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      return null;
    };
    
    const renderSuccessPopup = () => {
      if (!showSuccessPopup) return null;
      
      return (
        <View style={styles.congklaksuccessOverlay}>
          <View style={styles.congklaksuccessCard}>
            <Text style={styles.congklaksuccessTitle}>SELAMAT</Text>
            <Text style={styles.congklaksuccessText}>Kamu berhasil menyelesaikan misi ini!</Text>
            <View style={styles.congklaksuccessButtons}>
              <TouchableOpacity 
                style={styles.congklaksuccessButton} 
                onPress={handleNextMission}
              >
                <Text style={styles.congklaksuccessButtonText}>Misi Berikutnya</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.congklaksuccessButton} 
                onPress={handleOtherGames}
              >
                <Text style={styles.congklaksuccessButtonText}>Permainan Lain</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
  };

  return (
    !playing ? (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f7" />
      <TouchableWithoutFeedback onPress={()=>{setDetails(false)}}>
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
            colors={['#FFD54F', '#8BC34A']}
            style={styles.bannerContainer}
          >
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>Let's{'\n'}Play!</Text>
              <View style={styles.gameControllerContainer}>
                <Image 
                  source={require('@/assets/images/games-double.png')} 
                  style={styles.gameController} 
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
              {[
                {
                  icon: require('@/assets/icons/basic-computation.png'),
                  label: 'Basic\nComputation'
                },
                {
                  icon: require('@/assets/icons/cyber-security.png'),
                  label: 'Cyber\nSecurity'
                },
                {
                  icon: require('@/assets/icons/algorithms.png'),
                  label: 'Algorithms'
                },
              ].map((item, index) => (
                <TouchableOpacity key={index} style={styles.categoryItem}>
                  <View style={[styles.categoryIconContainer, {backgroundColor: '#D64545'}]}>
                    <Image 
                      source={item.icon} 
                      style={styles.categoryIcon} 
                    />
                  </View>
                  <Text style={styles.categoryText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Games */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Games</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.gamesGrid}>
              {[
                [
                  {
                    image: require('@/assets/images/congklak-2.png'),
                    name: 'CONGKLAK'
                  },
                  {
                    image: require('@/assets/images/benteng-2.png'),
                    name: 'BENTENG'
                  }
                ],
                [
                  {
                    image: require('@/assets/images/engklek-2.png'),
                    name: 'ENGKLEK'
                  },
                  {
                    image: require('@/assets/images/gaple-2.png'),
                    name: 'GAPLE'
                  }
                ]
              ].map((row, rowIndex) => (
                <View key={rowIndex} style={styles.gamesRow}>
                  {row.map((game, gameIndex) => (
                    <TouchableOpacity key={gameIndex} style={styles.gameCard} onPress={()=>{setDetails(!details)}}>
                      <Image 
                        source={game.image} 
                        style={styles.gameImage} 
                        resizeMode="cover"
                      />
                      <Text style={styles.gameName}>{game.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
        { details && (
          <Animated.View
          style={[
            styles.card,
            {
              height: animatedHeight,
              top: animatedPosition,
              borderTopLeftRadius: animatedBorderRadius,
              borderTopRightRadius: animatedBorderRadius,
            },
          ]}
        >
          <TouchableOpacity style={styles.dragIndicator} onPress={handleExpand} activeOpacity={0.7}>
            <View style={styles.dragBar} />
          </TouchableOpacity>
  
          {/* Exit Button */}
          <TouchableOpacity style={styles.exitButton} onPress={()=>{expanded ? handleExpand : setDetails(false)}}>
            <Text style={styles.exitButtonText}>×</Text>
          </TouchableOpacity>
  
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.gameHeader}>
              <Image source={require('@/assets/images/congklak-2.png')} style={styles.gameIcon} />
              <View style={styles.gameHeaderText}>
                <Text style={styles.gameTitle}>Congklak</Text>
                <View style={styles.tagsContainer}>
                  <View style={[styles.tag, styles.pinkTag]}>
                    <Text style={styles.tagText}>Basic Computation</Text>
                  </View>
                  <View style={[styles.tag, styles.blueTag]}>
                    <Text style={styles.tagText}>Algorithms</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.gamePreviewContainer}>
              <FlatList
                ref={flatListRef}
                data={gameImages}
                renderItem={renderCarouselItem}
                keyExtractor={(_, index) => index.toString()}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
              />
              <TouchableOpacity
                style={[styles.navButton, styles.leftNavButton, currentImageIndex === 0 && styles.disabledNavButton]}
                onPress={handlePrevImage}
                disabled={currentImageIndex === 0}
              >
                <Text style={styles.navButtonText}>{"<"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navButton, styles.rightNavButton, currentImageIndex === gameImages.length - 1 && styles.disabledNavButton]}
                onPress={handleNextImage}
                disabled={currentImageIndex === gameImages.length - 1}
              >
                <Text style={styles.navButtonText}>{">"}</Text>
              </TouchableOpacity>

              <View style={styles.paginationDots}>
                {gameImages.map((_, index) => (
                  <View key={index} style={[styles.dot, index === currentImageIndex && styles.activeDot]} />
                ))}
              </View>
            </View>

            <View style={styles.descriptionContainer}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descriptionText}>
                Congklak is redesigned to introduce fundamental programming logic where players must plan and execute moves using structured sequences to tackle missions in the most efficient way.
              </Text>
            </View>

            {expanded && (
              <View style={styles.howToPlayContainer}>
                <Text style={styles.sectionTitle}>How to Play</Text>
                {[...Array(4)].map((_, i) => (
                  <View key={i} style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.instructionText}>
                      {[
                        'Distribute your seeds counterclockwise around the board.',
                        "When landing in an empty hole on your side, capture opponent's seeds.",
                        'When landing in your store, you get another turn.',
                        'The player with the most seeds in their store at the end wins.',
                      ][i]}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.bottomPadding} />
          </ScrollView>
        <View style={styles.playButtonContainer}>
          <TouchableOpacity style={styles.playButton} onPress={playCongklak}>
            <Text style={styles.playButtonText}>Play!</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      ) }
    </SafeAreaView>
    ) : (
      <ImageBackground 
            style={styles.congklakcontainer}
            source={require('@/assets/images/background.png')}
          >
            {/* Toggle button to show/hide controls */}
            <TouchableOpacity 
              style={styles.congklaktoggleButton} 
              onPress={toggleControls}
            >
              <Text style={styles.congklaktoggleButtonText}>{controlsVisible ? '▲' : '▼'}</Text>
            </TouchableOpacity>
      
            {/* Left controls panel */}
            {controlsVisible && (
              <View style={styles.congklakleftControls}>
                <TouchableOpacity style={styles.congklakcontrolButton} onPress={handleShowMission}>
                  <Text style={styles.congklakcontrolText}>≡</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.congklakcontrolButton} onPress={handleRetryRequest}>
                  <Text style={styles.congklakcontrolText}>↻</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.congklakcontrolButton} onPress={handleExitRequest}>
                  <Text style={styles.congklakcontrolText}>←</Text>
                </TouchableOpacity>
              </View>
            )}
      
            <View style={styles.congklakboardContainer}>
              {renderCard()}
              {renderSuccessPopup()}
              
              <Image 
                style={styles.congklakboardImage} 
                source={require('@/assets/images/congklak-6.png')} 
              />
      
              <View style={styles.congklakboard}>
                {/* Home pits */}
                {renderHomePit(0, 'left')}
                {renderHomePit(6, 'right')}
                
                {/* Top Row Labels */}
                <View style={styles.congklaklabelsRow}>
                  <Text style={styles.congklakemptyLabel}></Text>
                  <Text style={styles.congklaklabel}>A1</Text>
                  <Text style={styles.congklaklabel}>A2</Text>
                  <Text style={styles.congklaklabel}>A3</Text>
                  <Text style={styles.congklaklabel}>A4</Text>
                  <Text style={styles.congklaklabel}>A5</Text>
                  <Text style={styles.congklakemptyLabel}></Text>
                </View>
      
                {/* Top row pits */}
                <View style={styles.congklaktopPitsContainer}>
                  <View style={styles.congklakpitsRow}>
                    {[1, 2, 3, 4, 5].map((index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.congklakpit, isSelectable(index) && styles.congklakselectablePit]}
                        onPress={() => handlePitSelect(index)}
                      >
                        <View style={styles.congklakseedContainer}>
                          {renderSeeds(board[index])}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
      
                {/* Bottom row pits */}
                <View style={styles.congklakbottomPitsContainer}>
                  <View style={styles.congklakpitsRow}>
                    {[7, 8, 9, 10, 11].map((index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.congklakpit, isSelectable(index) && styles.congklakselectablePit]}
                        onPress={() => handlePitSelect(index)}
                      >
                        <View style={styles.congklakseedContainer}>
                          {renderSeeds(board[index])}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                {/* Bottom Row Labels */}
                <View style={styles.congklaklabelsRow}>
                  <Text style={styles.congklakemptyLabel}></Text>
                  <Text style={styles.congklaklabel}>B1</Text>
                  <Text style={styles.congklaklabel}>B2</Text>
                  <Text style={styles.congklaklabel}>B3</Text>
                  <Text style={styles.congklaklabel}>B4</Text>
                  <Text style={styles.congklaklabel}>B5</Text>
                  <Text style={styles.congklakemptyLabel}></Text>
                </View>
              </View>
            </View>
          </ImageBackground>
    )
  );
}

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
    marginTop: 15,
    borderRadius: 18,
    overflow: 'hidden',
  },
  bannerContent: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  gameControllerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  gameController: {
    width: 300,
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
    marginTop: 25,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#000',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
    marginBottom: 15,
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
    width: 60,
    height: 60,
    borderRadius: 30,
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
    fontWeight: '500',
    textAlign: 'center',
    color: '#000',
  },
  exitButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitButtonText: {
    fontSize: 20,
    color: '#333',
  },
  gamesGrid: {
    marginBottom: 80,
  },
  gamesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  gameCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  gameImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  gameName: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 12,
    color: '#000',
  },
  logoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  dragIndicator: {
    width: '100%',
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8
  },
  dragBar: {
    width: 60,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 24,
  },
  gameHeader: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
  },
  gameIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 16,
  },
  gameHeaderText: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  pinkTag: {
    backgroundColor: '#FFCECE',
  },
  blueTag: {
    backgroundColor: '#D1E5FF',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  gamePreviewContainer: {
    marginTop: 20,
    height: 180,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  carouselItem: {
    width: width - 48, // Account for padding
    height: 180,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  navButton: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    top: '50%',
    marginTop: -16, // Center vertically
    zIndex: 2,
  },
  leftNavButton: {
    left: 12,
  },
  rightNavButton: {
    right: 12,
  },
  navButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  },
  disabledNavButton: {
    opacity: 0.5,
  },
  paginationDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#FFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  descriptionContainer: {
    marginTop: 24,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  howToPlayContainer: {
    marginTop: 24,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ED5B3A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  playButtonContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  playButton: {
    backgroundColor: '#ED5B3A',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60
  },
  playButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  bottomPadding: {
    height: 100,
  },
  congklakcontainer: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  congklaktoggleButton: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(51, 51, 51, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 10,
  },
  congklaktoggleButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  congklakleftControls: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingLeft: 5,
    zIndex: 5,
  },
  congklakcontrolButton: {
    width: 50,
    height: 50,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    borderRadius: 25,
  },
  congklakcontrolText: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  congklakboardContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  congklakboardImage: {
    position: 'absolute',
    width: '90%',
    height: '80%',
    resizeMode: 'contain',
  },
  congklakboard: {
    width: '90%',
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 30,
    zIndex: 1,
  },
  congklaklabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginVertical: 5,
  },
  congklaklabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C78C4D',
    textAlign: 'center',
    width: 40,
  },
  congklakemptyLabel: {
    width: 40,
  },
  congklaktopPitsContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
  },
  congklakbottomPitsContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
  },
  congklakpitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '70%',
  },
  congklakpit: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(210, 180, 140, 0.2)', // More transparent to see the board holes
    overflow: 'hidden',
  },
  congklakselectablePit: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  congklakseedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  congklakseedImage: {
    width: 10,
    height: 10,
    resizeMode: 'contain',
  },
  congklakseedCountContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 5,
  },
  congklakseedCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  congklakhomePit: {
    position: 'absolute', 
    width: 80,
    height: 120,
    backgroundColor: 'rgba(210, 180, 140, 0.2)', // More transparent to see the board holes
    borderRadius: 40,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    top: '40%',
    zIndex: 2,
    overflow: 'hidden',
  },
  congklakleftHomePit: {
    left: '5%',
  },
  congklakrightHomePit: {
    right: '5%',
  },
  congklakhomePitLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C78C4D',
  },
  congklakhomePitSeedsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '80%',
    position: 'relative',
  },
  congklakextraSeedsContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 5,
  },
  congklakextraSeedsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  congklakcard: {
    position: 'absolute',
    top: '30%',
    width: '80%',
    padding: 20,
    backgroundColor: '#F9E4C0', // Solid color for the card
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#A67C52',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  congklakcardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#8B4513',
  },
  congklakcardText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: '#5D4037',
  },
  congklakcardButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
  },
  congklakcardButton: {
    backgroundColor: '#000000',
    borderRadius: 25,
    padding: 15,
    margin: 10,
    width: 100,
    alignItems: 'center',
  },
  congklakcardButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  congklakhiddenButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Success popup styles
  congklaksuccessOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 110,
  },
  congklaksuccessCard: {
    width: '80%',
    padding: 25,
    backgroundColor: 'rgba(206, 79, 79, 0.9)',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  congklaksuccessTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  congklaksuccessText: {
    fontSize: 20,
    marginBottom: 30,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  congklaksuccessButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    flexWrap: 'wrap',
  },
  congklaksuccessButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 20,
    margin: 10,
    minWidth: 180,
    alignItems: 'center',
  },
  congklaksuccessButtonText: {
    color: '#CE4F4F',
    fontSize: 16,
    fontWeight: 'bold',
  },
});