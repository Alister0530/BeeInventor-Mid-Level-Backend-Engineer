import { TrieWordDictionary } from '../solution/TrieWordDictionary';
import { runWordDictionaryContractTests } from './wordDictionary.contract';

runWordDictionaryContractTests('TrieWordDictionary', () => new TrieWordDictionary());
