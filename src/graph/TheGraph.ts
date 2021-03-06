import fetch from 'cross-fetch';
import { AssetProtocol } from '../model/PickleModelJson';

const SUBGRAPH_URL_PICKLE: string = "https://api.thegraph.com/subgraphs/name/pickle-finance/pickle"
const SUBGRAPH_URL_PICKLE_POLYGON: string = "https://api.thegraph.com/subgraphs/name/pickle-finance/pickle-polygon"

const SUBGRAPH_URL_UNISWAP = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2"
const SUBGRAPH_URL_SUSHISWAP = "https://api.thegraph.com/subgraphs/name/croco-finance/sushiswap"
const SUBGRAPH_URL_SUSHISWAP_POLYGON = "https://api.thegraph.com/subgraphs/name/sushiswap/matic-exchange"
const SUBGRAPH_URL_COMETH = "https://api.thegraph.com/subgraphs/name/cometh-game/comethswap"
const SUBGRAPH_URL_QUICKSWAP = "https://api.thegraph.com/subgraphs/name/sameepsi/quickswap06"


export const protocolToSubgraphUrl : Map<string,string> = new Map([
    [AssetProtocol.UNISWAP,SUBGRAPH_URL_UNISWAP],
    [AssetProtocol.SUSHISWAP,SUBGRAPH_URL_SUSHISWAP],
    [AssetProtocol.SUSHISWAP_POLYGON,SUBGRAPH_URL_SUSHISWAP_POLYGON],
    [AssetProtocol.COMETHSWAP,SUBGRAPH_URL_COMETH],
    [AssetProtocol.QUICKSWAP_POLYGON,SUBGRAPH_URL_QUICKSWAP], //TODO is this right?
]);

export async function readQueryFromGraphProtocol(query:string, protocol: string) : Promise<any> {
  return await readQueryFromGraph(query, protocolToSubgraphUrl.get(protocol));
}


export async function readQueryFromGraph(query:string, url: string) : Promise<any> {
    const tst =  await fetch(url, {
        method: "POST",
        body: JSON.stringify({ query })
      });
    try {
      return tst.json();
    } catch(error) {
      console.log(error);
      console.log(tst);
    }
}


module.exports.getMasterChef = async () => {
    const query = `
      {
        masterChef(id: "0xbd17b1ce622d73bd438b9e658aca5996dc394b0d") {
          id
          totalAllocPoint
          rewardsPerBlock
        },
        masterChefPools(where: {allocPoint_gt: 0}, orderBy: allocPoint, orderDirection: desc) {
          id
          token {
            id
          }
          balance
          allocPoint
          lastRewardBlock
          accPicklePerShare
        }
      }
    `;
    return await readQueryFromGraph(query, SUBGRAPH_URL_PICKLE);
  };