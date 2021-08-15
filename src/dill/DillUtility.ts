import { AssetEnablement, DillDetails, DillWeek, JarDefinition } from "../model/PickleModelJson";
import { BigNumber, ethers, Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import {  Provider as MulticallProvider, Contract as MulticallContract} from 'ethers-multicall';
import dillAbi from "../Contracts/ABIs/dill.json";
import feeDistributorAbi from "../Contracts/ABIs/fee-distributor.json";
import { PriceCache } from "../price/PriceCache";
import { fetchHistoricalPriceSeries } from "../price/CoinGeckoPriceResolver";
import moment from "moment";

const week = 7 * 24 * 60 * 60;
const firstMeaningfulDistributionTimestamp = 1619049600;

const DILL_CONTRACT = "0xbBCf169eE191A1Ba7371F30A1C344bFC498b29Cf";
const FEE_DISTRIBUTOR = "0x74C6CadE3eF61d64dcc9b97490d9FbB231e4BdCc";

export function getWeeklyDistribution(_jars: JarDefinition[] ) : number {
  /*
  let weeklyProfit = 0;
  for( let i = 0; i < jars.length; i++ ) {
    if( jars[i].enablement === AssetEnablement.ENABLED || jars[i].enablement === AssetEnablement.DEV) {
      if( jars[i].details && jars[i].details.harvestStats && jars[i].details.harvestStats.balanceUSD) {
        const weeklyProfitPerJar = jars[i].details.harvestStats.balanceUSD * 
                jars[i].details.threeDayApy * .01 * 0.2 / 52;
        weeklyProfit += weeklyProfitPerJar;          
      }
    }
  }
  return weeklyProfit * 0.45;
  */
 // We don't have the apy anymore, it's from DB
 return 0;
}

export async function getDillDetails(thisWeekProjectedDistribution: number, 
                priceCache: PriceCache, resolver: Signer | Provider) : Promise<DillDetails> {
    const multicallProvider = new MulticallProvider((resolver as Signer).provider === undefined ? (resolver as Provider) : (resolver as Signer).provider);
    await multicallProvider.init();

    try {

        const dillContract = new MulticallContract(DILL_CONTRACT, dillAbi);
        const [picklesLocked, dillSupply] : number[] = await multicallProvider.all<number[]>(
            [dillContract.supply(),dillContract.totalSupply()]
        );

        const supply = picklesLocked;//.mul(dec18);
        const supplyFloat = parseFloat(ethers.utils.formatEther(supply));

        const totalSupply = dillSupply;//.mul(dec18);
        const totalSupplyFloat = parseFloat(ethers.utils.formatEther(totalSupply));


        // Ignore initial negligible distributions that distort
        // PICKLE/DILL ratio range.
        const feeDistContract = new MulticallContract(FEE_DISTRIBUTOR, feeDistributorAbi);
        const startTime = ethers.BigNumber.from(
            firstMeaningfulDistributionTimestamp,
        );
        const [endTime] = await multicallProvider.all<BigNumber[]>([
            feeDistContract.time_cursor(),
        ]);
        const payoutTimes: BigNumber[] = [];
        for (
          let time = startTime;
          time.lt(endTime);
          time = time.add(ethers.BigNumber.from(week))
        ) {
          payoutTimes.push(time);
        }
  
        const payouts = await multicallProvider.all<BigNumber[]>(
          payoutTimes.map((time) => feeDistContract.tokens_per_week(time)),
        );
  
        const dillAmounts = await multicallProvider.all<BigNumber[]>(
          payoutTimes.map((time) => feeDistContract.ve_supply(time)),
        );
  
        const picklePriceSeries = await fetchHistoricalPriceSeries({
          from: new Date(firstMeaningfulDistributionTimestamp * 1000),
        });
  
        let totalPickleAmount = 0;
        let lastTotalDillAmount = 0;
  

        const mapResult : DillWeek[] = payoutTimes.map((time, index) : DillWeek => {
            // Fees get distributed at the beginning of the following period.
            const distributionTime = new Date((time.toNumber() + week) * 1000);
            const isProjected = distributionTime > new Date();
  
            const weeklyPickleAmount = isProjected
              ? thisWeekProjectedDistribution / priceCache.get("pickle")
              : parseFloat(ethers.utils.formatEther(payouts[index]));
  
            const historicalEntry = picklePriceSeries.find((value) =>
              moment(value[0]).isSame(distributionTime, "day"),
            );
            const picklePriceUsd = historicalEntry
              ? historicalEntry[1]
              : priceCache.get("pickle")
  
            const totalDillAmount = parseFloat(
              ethers.utils.formatEther(dillAmounts[index]),
            );
            const pickleDillRatio = weeklyPickleAmount / totalDillAmount;
  
            totalPickleAmount += weeklyPickleAmount;
  
            const weeklyDillAmount = totalDillAmount - lastTotalDillAmount;
            lastTotalDillAmount = totalDillAmount;
  
            return {
              weeklyPickleAmount,
              totalPickleAmount,
              weeklyDillAmount,
              totalDillAmount,
              pickleDillRatio,
              picklePriceUsd,
              isProjected,
              distributionTime,
            };
        });


        return {
            pickleLocked: totalSupplyFloat,
            totalDill: supplyFloat,
            dillWeeks: mapResult
        };
    } catch( e ) {
        console.log(e);
        return undefined;
    }
}
