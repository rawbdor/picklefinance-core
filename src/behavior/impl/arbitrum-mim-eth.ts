import { BigNumber, ethers, Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { PickleModel } from '../..';
import { JarDefinition, AssetProjectedApr } from '../../model/PickleModelJson';
import erc20Abi from '../../Contracts/ABIs/erc20.json';
import { multiSushiStrategyAbi } from '../../Contracts/ABIs/multi-sushi-strategy.abi';
import { AbstractJarBehavior } from '../AbstractJarBehavior';
import { calculateMCv2ApyArbitrum, calculateSushiApyArbitrum } from '../../protocols/SushiSwapUtil';

export class ArbitrumMimEth extends AbstractJarBehavior {

  constructor() {
    super();
  }

  async getDepositTokenPrice(definition: JarDefinition, model: PickleModel): Promise<number> {
    return super.getDepositTokenPrice(definition, model);
  }

  async getHarvestableUSD( jar: JarDefinition, model: PickleModel, resolver: Signer | Provider): Promise<number> {
    const strategy = new ethers.Contract(jar.details.strategyAddr, multiSushiStrategyAbi, resolver);
    const spellToken = new ethers.Contract(model.address("mim", jar.chain), erc20Abi, resolver);
    const [res, spellWallet, spellPrice, sushiPrice]: [BigNumber[], BigNumber, number, number] = await Promise.all([
      strategy.getHarvestable().catch(() => BigNumber.from('0')),
      spellToken.balanceOf(jar.details.strategyAddr).catch(() => BigNumber.from('0')),
      model.priceOfSync("mim"),
      model.priceOfSync("sushi"),
    ]);

    const sushiValue = res[0].mul(sushiPrice.toFixed());
    const spellValue = res[1].add(spellWallet).mul(spellPrice.toFixed());
    const harvestable = spellValue.add(sushiValue);
    return parseFloat(ethers.utils.formatEther(harvestable));
  }

  async getProjectedAprStats(jar: JarDefinition, model: PickleModel) : Promise<AssetProjectedApr> {
    const [
      sushiMimEthApy,
      spellMimEthApy
    ] = await Promise.all([
      calculateSushiApyArbitrum(jar, model),
      calculateMCv2ApyArbitrum(jar, model, "spell")
    ]);

    return this.aprComponentsToProjectedApr([
      this.createAprComponent("sushi", sushiMimEthApy * 100, true),
      this.createAprComponent("spell", spellMimEthApy * 100, true)
    ]);
  }



}
