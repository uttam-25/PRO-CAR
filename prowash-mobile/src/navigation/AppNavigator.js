import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import NewInspectionScreen from '../screens/NewInspectionScreen';
import InspectionHistoryScreen from '../screens/InspectionHistoryScreen';
import InspectionDetailScreen from '../screens/InspectionDetailScreen';
import DamageReportScreen from '../screens/DamageReportScreen';
import ReportsScreen from '../screens/ReportsScreen';

import Colors from '../constants/colors';

const Tab = createBottomTabNavigator();
const NewInspectionStack = createStackNavigator();
const HistoryStack = createStackNavigator();
const ReportsStack = createStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: Colors.midnightNavy },
  headerTintColor: Colors.cloudWhite,
  headerTitleStyle: { fontWeight: 'bold' },
};

function NewInspectionNavigator() {
  return (
    <NewInspectionStack.Navigator screenOptions={screenOptions}>
      <NewInspectionStack.Screen
        name="NewInspectionScreen"
        component={NewInspectionScreen}
        options={{ title: 'New Inspection' }}
      />
      <NewInspectionStack.Screen
        name="InspectionDetailScreen"
        component={InspectionDetailScreen}
        options={{ title: 'Inspection Detail' }}
      />
      <NewInspectionStack.Screen
        name="DamageReportScreen"
        component={DamageReportScreen}
        options={{ title: 'Damage Report' }}
      />
    </NewInspectionStack.Navigator>
  );
}

function HistoryNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={screenOptions}>
      <HistoryStack.Screen
        name="InspectionHistoryScreen"
        component={InspectionHistoryScreen}
        options={{ title: 'Inspection History' }}
      />
      <HistoryStack.Screen
        name="InspectionDetailScreen"
        component={InspectionDetailScreen}
        options={{ title: 'Inspection Detail' }}
      />
      <HistoryStack.Screen
        name="DamageReportScreen"
        component={DamageReportScreen}
        options={{ title: 'Damage Report' }}
      />
    </HistoryStack.Navigator>
  );
}

function ReportsNavigator() {
  return (
    <ReportsStack.Navigator screenOptions={screenOptions}>
      <ReportsStack.Screen
        name="ReportsScreen"
        component={ReportsScreen}
        options={{ title: 'Reports' }}
      />
      <ReportsStack.Screen
        name="DamageReportScreen"
        component={DamageReportScreen}
        options={{ title: 'Damage Report' }}
      />
    </ReportsStack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { backgroundColor: Colors.midnightNavy, borderTopColor: Colors.oceanBlue },
          tabBarActiveTintColor: Colors.aqua,
          tabBarInactiveTintColor: Colors.textLight,
          tabBarIcon: ({ color, size }) => {
            let iconName;
            if (route.name === 'New Inspection') iconName = 'car-check';
            else if (route.name === 'History') iconName = 'clipboard-list';
            else if (route.name === 'Reports') iconName = 'file-chart';
            return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="New Inspection" component={NewInspectionNavigator} />
        <Tab.Screen name="History" component={HistoryNavigator} />
        <Tab.Screen name="Reports" component={ReportsNavigator} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
