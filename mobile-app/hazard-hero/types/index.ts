import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

type RootParamList = {
  'MainPage': undefined;
  'AddSignPage': {page: number, ssid?: any};
};

type Product = {
  name: string;
  company: string;
  ingredients: string[];
};

type KWBNavProp = StackNavigationProp<RootParamList>;

type AddSignPageRouteProp = RouteProp<RootParamList, 'AddSignPage'>;
// type BarcodeScannedPageRouteProp = RouteProp<RootParamList, 'BarcodeScannedPage'>;

export type {
  RootParamList,
  KWBNavProp,
  AddSignPageRouteProp,
  // BarcodeScannedPageRouteProp,
  Product,
};