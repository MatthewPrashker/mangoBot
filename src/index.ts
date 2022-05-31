import * as os from 'os';
import * as fs from 'fs';

//Solana
import { 
    Commitment, 
    Connection, 
    Keypair, 
    PublicKey, 
    Transaction 
} from '@solana/web3.js';

//Serum
import { 
    Market, 
    OpenOrders, 
} from '@project-serum/serum';

//Mango
import {
  Config,
  MangoClient,
  MangoGroup,
  MangoAccount,
  GroupConfig,
  getMarketByBaseSymbolAndKind,
} from '@blockworks-foundation/mango-client';

import ids from '../ids.json';

//globals
const cluster = 'mainnet';
const group = 'mainnet.1';
const myMangoAccountAddress = 'EsZWvt5hYSVYDp81374HkQpVvG7NctiTzzVpmkA17YXf';

let connection : Connection; //Solana RPC Connection

let payer : Keypair //Solana KeyPair
let client : MangoClient;
let mangoGroup : MangoGroup;
let mangoAccount : MangoAccount;
let groupConfig : GroupConfig | undefined; 


async function init() {
  const config = new Config(ids);
  groupConfig = config.getGroup(cluster, group);
  if (!groupConfig) {
      throw new Error('unable to read Mango group config file');
  }
  const clusterData = ids.groups.find((g) => {
    return g.name == group && g.cluster == cluster;
  });
  if(!clusterData) {
    throw new Error('unable to get cluster data for Group ${group}');
  }


  const mangoGroupKey = groupConfig.publicKey;
  const mangoProgramPk = new PublicKey(clusterData.mangoProgramId);
  const myMangoAccountPk = new PublicKey(myMangoAccountAddress);
  
  const serumProgramPk = new PublicKey(clusterData.serumProgramId);
  
  const clusterUrl = ids.cluster_urls[cluster]; //Change to other RPC endpoint under congestion
  connection = new Connection(clusterUrl, 'processed' as Commitment);
  
  client = new MangoClient(connection, mangoProgramPk);
  mangoAccount = await client.getMangoAccount(myMangoAccountPk, serumProgramPk);
  mangoGroup = await client.getMangoGroup(mangoGroupKey);

  payer = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        process.env.PRIVATE_KEY ||
          fs.readFileSync(
            process.env.KEYPAIR || os.homedir() + '/.config/solana/id.json',
            'utf-8',
          ),
      ),
    ),
  );
}

async function getPerpMarket(sym : string) {
    const perpMarketConfig = getMarketByBaseSymbolAndKind(
        groupConfig,
        sym,
        'perp'
    );
    console.log(perpMarketConfig);

    return (await mangoGroup.loadPerpMarket(
        connection, 
        perpMarketConfig.marketIndex,
        perpMarketConfig.baseDecimals,
        perpMarketConfig.quoteDecimals
    ));
}

async function getSerumSpotMarket(sym : string) {
    const marketData = groupConfig.spotMarkets.find((m) => {
        return m.baseSymbol === sym;
    });
    const marketProgramPk = new PublicKey(marketData.publicKey);
    const serumProgramPk = new PublicKey(groupConfig.serumProgramId);
    return (await Market.load(connection, marketProgramPk, {}, serumProgramPk));
}

async function main() {
  await init();
  const market = await getSerumSpotMarket("SOL");
  console.log(market);
  const perpMarket = await getPerpMarket("SOL");
  console.log(perpMarket);
  //console.log(groupIds);
  //buyPerp("SOL", 47, .1);

}

main();