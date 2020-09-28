import React from 'react'
import { Switch, Route, useRouteMatch } from 'react-router-dom'

import { useStreamQuery } from '@daml/react'
import { AssetDeposit } from '@daml.js/da-marketplace/lib/DA/Finance/Asset'
import { Exchange } from '@daml.js/da-marketplace/lib/Marketplace/Exchange'
import { RegisteredInvestor } from '@daml.js/da-marketplace/lib/Marketplace/Registry'
import { MarketRole } from '@daml.js/da-marketplace/lib/Marketplace/Utils'

import RequestCustodianRelationship from '../common/RequestCustodianRelationship'
import OnboardingTile from '../common/OnboardingTile'
import LandingPage from '../common/LandingPage'
import Holdings from '../common/Holdings'

import { useExchangeInviteNotifications } from './ExchangeInviteNotifications'
import InviteAcceptScreen from './InviteAcceptScreen'
import InvestorSideNav from './InvestorSideNav'
import InvestorTrade from './InvestorTrade'
import InvestorOrders from './InvestorOrders'


type Props = {
    onLogout: () => void;
}

const Investor: React.FC<Props> = ({ onLogout }) => {
    const { path, url } = useRouteMatch();
    const notifications = useExchangeInviteNotifications();
    const registeredInvestor = useStreamQuery(RegisteredInvestor);

    // const allRegisteredExchanges = useStreamQueryAsPublic(RegisteredExchange).contracts;
    // const exchangeMap = allRegisteredExchanges.reduce((accum, contract) => accum.set(damlTupleToString(contract.key), contract.payload.name), new Map());
    // console.log(exchangeMap);

    // const allExchanges = useStreamQuery(Exchange).contracts
    //     .map(exchange => {
    //         console.log(exchangeMap.get(exchange.key));
    //         return ({contractId: exchange.contractId, contractData: exchange.payload, name: exchangeMap.get(damlTupleToString(exchange.key))})
    //     });

    const allExchanges = useStreamQuery(Exchange).contracts
        .map(exchange => {
            return ({contractId: exchange.contractId, contractData: exchange.payload});
            // ({contractId: exchange.contractId, contractData: exchange.payload, name: exchangeMap.get(damlTupleToString(exchange.key))})
        });


    const allDeposits = useStreamQuery(AssetDeposit).contracts
        .map(deposit => ({contractId: deposit.contractId, contractData: deposit.payload}));

    const sideNav = <InvestorSideNav url={url} exchanges={allExchanges}/>;
    const inviteScreen = <InviteAcceptScreen onLogout={onLogout}/>
    const loadingScreen = <OnboardingTile>Loading...</OnboardingTile>
    const investorScreen = <Switch>
        <Route exact path={path}>
            <LandingPage
                sideNav={sideNav}
                notifications={notifications}
                marketRelationships={<RequestCustodianRelationship role={MarketRole.InvestorRole}/>}
                onLogout={onLogout}/>
        </Route>

        <Route path={`${path}/wallet`}>
            <Holdings
                sideNav={sideNav}
                onLogout={onLogout}
                deposits={allDeposits}
                role={MarketRole.InvestorRole}
                exchanges={allExchanges}/>
        </Route>

        <Route path={`${path}/orders`}>
            <InvestorOrders
                sideNav={sideNav}
                onLogout={onLogout}/>
        </Route>

        <Route path={`${path}/trade/:base-:quote`}>
            <InvestorTrade
                deposits={allDeposits}
                sideNav={sideNav}
                onLogout={onLogout}/>
        </Route>
    </Switch>

    return registeredInvestor.loading
         ? loadingScreen
         : registeredInvestor.contracts.length === 0 ? inviteScreen : investorScreen
}

export default Investor;
